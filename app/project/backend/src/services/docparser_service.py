"""
Bridges the school app with docParser and exam-forge dataset.

Flow:
  1. Teacher uploads PDF → school app saves it → auto-parse triggered in background
  2. docParser runs as subprocess on the PDF
  3. Output JSON converted to exam-forge Schema A format
  4. Saved to exam-forge/backend/data/final_unified/{ai_subject}/teacher_{teacher_id}/
  5. exam-forge loads shared data (courses/, td/) + teacher's own folder on generation
  6. Cloud RAG: /api/index-file called so content is immediately searchable via pgvector
"""

import asyncio
import json
import os
import sys
import httpx
from pathlib import Path

# Read OPENROUTER_API_KEY from exam-forge .env (docParser needs it for LLM extraction)
def _load_openrouter_key() -> str:
    env_path = Path("/home/meriem/llm-project/exam-forge/backend/.env")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("OPENROUTER_API_KEY="):
                return line.split("=", 1)[1].strip()
    return os.getenv("OPENROUTER_API_KEY", "")

_OPENROUTER_KEY = _load_openrouter_key()

_SUBJECT_KEYWORDS: dict[str, list[str]] = {
    "algo":        ["algo", "algorithme", "algorithm", "structure", "données",
                    "الخوارزم", "خوارزم", "بنية", "هياكل"],
    "se":          ["se", "software", "genie logiciel", "génie logiciel", "systeme", "système", "system",
                    "exploitation", "operating", "نظام التشغيل", "نظام الاستغلال", "هندسة البرمجيات"],
    "commerce":    ["commerce", "business", "marketing", "gestion", "economie", "économie",
                    "إحصاء", "إحصائي", "احصاء", "احصائي", "اقتصاد", "تجارة", "تسيير"],
    "Law":         ["law", "droit", "juridique", "legal",
                    "قانون", "القانون", "التزام", "الالتزام", "حق", "حقوق", "مصادر", "أحكام"],
    "compilation": ["compilation", "compilateur", "compiler", "langage", "language", "automate",
                    "ترجمة", "مترجم", "لغة برمجة"],
}


def auto_detect_subject(subject_name: str) -> str:
    """Map a school subject name to an exam-forge ai_subject key."""
    name = subject_name.lower()
    for subject, keywords in _SUBJECT_KEYWORDS.items():
        if any(kw in name for kw in keywords):
            return subject
    return "algo"  # safe default

DOCPARSER_ROOT  = Path("/home/meriem/llm-project")
EXAM_FORGE_DATA = Path("/home/meriem/llm-project/exam-forge/backend/data/final_unified")
TMP_DIR         = Path("/tmp/docparser_out")

# Track parse jobs: pdf_id -> {"status": pending|done|error, "detail": str}
_parse_status: dict[int, dict] = {}


def get_parse_status(pdf_id: int) -> dict:
    return _parse_status.get(pdf_id, {"status": "not_started"})


def _convert(exam_json: dict, subject: str, source_name: str) -> dict:
    """Convert docParser Exam JSON → exam-forge Schema A."""
    meta = exam_json.get("metadata", {}) or {}
    result = {
        "metadata": {
            "module": meta.get("title", source_name),
            "language": meta.get("language", "french"),
        },
        "exercises": [],
    }
    for ex in exam_json.get("exercises", []) or []:
        # docParser uses "Question" (capital Q); fall back to "questions" for safety
        questions = ex.get("Question", []) or ex.get("questions", []) or []
        converted_qs = []
        for q in questions:
            stem = (q.get("question_text") or "").strip()
            if not stem:
                continue
            # docParser uses "Solution" (capital S) as a dict with a "text" key
            sol = q.get("Solution", {}) or q.get("solution", {})
            sol_text = sol.get("text", "") if isinstance(sol, dict) else str(sol)
            converted_qs.append({
                "question_text": stem,
                "Solution": sol_text,
                "level": q.get("level") or "Conceptual",
            })
        if not converted_qs:
            continue
        result["exercises"].append({
            "title": ex.get("title", ""),
            "introduction_context": ex.get("intro_context", ""),
            "Question": converted_qs,
        })
    return result


async def parse_pdf_async(pdf_id: int, pdf_path: str, ai_subject: str, source_name: str, teacher_id: int = 0):
    """Background task: parse PDF and add questions to exam-forge dataset."""
    _parse_status[pdf_id] = {"status": "pending", "detail": "Running docParser…"}
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    try:
        env = {
            **os.environ,
            "OPENROUTER_API_KEY": _OPENROUTER_KEY,
            "PYTHONPATH": str(DOCPARSER_ROOT),   # so docParser package is importable
        }
        proc = await asyncio.create_subprocess_exec(
            sys.executable, "-m", "docParser.parse", pdf_path,
            "--output-dir", str(TMP_DIR),
            cwd=str(DOCPARSER_ROOT),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            raise RuntimeError(stderr.decode(errors="replace")[:300])

        # Find output JSON (docParser names it after the PDF stem)
        pdf_stem = Path(pdf_path).stem
        candidates = list(TMP_DIR.glob(f"{pdf_stem}*.json"))
        if not candidates:
            candidates = sorted(TMP_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        if not candidates:
            raise RuntimeError("docParser produced no JSON output")

        exam_json = json.loads(candidates[0].read_text(encoding="utf-8"))
        converted  = _convert(exam_json, ai_subject, source_name)

        total_q = sum(len(ex.get("Question", [])) for ex in converted["exercises"])
        if total_q == 0:
            raise RuntimeError("No questions extracted from PDF")

        # Files organized by subject then teacher: {ai_subject}/teacher_{id}/
        # This keeps each subject's data separate and prevents cross-subject contamination.
        target_dir = EXAM_FORGE_DATA / ai_subject / f"teacher_{teacher_id}"
        target_dir.mkdir(parents=True, exist_ok=True)
        safe = source_name.replace(" ", "_").replace("/", "_")[:60]
        (target_dir / f"{safe}.json").write_text(
            json.dumps(converted, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        _parse_status[pdf_id] = {"status": "done", "detail": f"{total_q} questions extracted"}

        saved_path = target_dir / f"{safe}.json"
        # Invalidate dataset cache so next generation uses the new file immediately
        await _invalidate_cache(f"teacher_{teacher_id}")
        # Cloud RAG: index the parsed JSON (best-effort)
        await _index_file_in_rag(
            user_id=f"teacher_{teacher_id}",
            subject=ai_subject,
            file_path=saved_path,
        )

    except Exception as exc:
        _parse_status[pdf_id] = {"status": "error", "detail": str(exc)}


async def _invalidate_cache(user_id: str) -> None:
    """Tell exam-forge to drop the cached Dataset for this teacher."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                "http://127.0.0.1:28000/api/invalidate-cache",
                params={"user_id": user_id},
            )
    except Exception:
        pass


async def _index_file_in_rag(user_id: str, subject: str, file_path: Path) -> None:
    """Fire-and-forget: tell exam-forge to index this file in cloud RAG."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                "http://127.0.0.1:28000/api/index-file",
                json={
                    "user_id": user_id,
                    "subject": subject,
                    "file_path": str(file_path),
                    "passed_parser": True,
                },
            )
    except Exception:
        pass  # RAG indexing is best-effort; parsing already succeeded
