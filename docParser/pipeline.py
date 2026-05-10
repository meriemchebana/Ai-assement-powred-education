"""
docParser — IDP pipeline based on the article's architecture.

PIPELINE (3 stages from the article):

  Stage 1 │ PDF ──► Docling ──► Markdown
          │         (TableFormer, layout-aware, RTL-safe)
          │         Fallback: PyMuPDF raw text
          │
  Stage 2 │ Markdown ──► LLM + Instructor ──► Exam (Pydantic)
          │              (self-healing, max_retries=3)
          │              Provider: DeepSeek / Gemini / OpenRouter / Claude
          │
  Stage 3 │ Exam ──► Validator ──► final Exam
                     (grounding, orphan cleanup, confidence score)

Output: Exam object → JSON file
"""
from __future__ import annotations
import json
from pathlib import Path
from typing import Callable
from docParser.convert.docling_convert import convert_with_fallback
from docParser.extract.llm_extract import extract
from docParser.validate.validator import validate
from docParser.evaluate.level_eval import evaluate_levels
from docParser.vision.vlm_describe import extract_and_describe
from docParser.schema.exam import Exam

# Progress callback type: fn(phase, message, extra_data)
ProgressCallback = Callable[[str, str, dict], None]


def parse_pdf(
    pdf_path: str,
    output_dir: str | None = None,
    on_progress: ProgressCallback | None = None,
) -> Exam:
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(pdf_path)

    def _progress(phase: str, message: str, **extra):
        print(f"[{phase}] {message}")
        if on_progress:
            on_progress(phase, message, extra)

    # ── Stage 1: PDF → Markdown ───────────────────────────────────────────────
    _progress("converting", f"Converting PDF to Markdown… ({path.name})")
    conversion = convert_with_fallback(pdf_path)
    _progress(
        "converting",
        f"Conversion done — {conversion.page_count} pages"
        + (", has tables" if conversion.has_tables else ""),
        page_count=conversion.page_count,
        has_tables=conversion.has_tables,
        source=conversion.source,
    )

    # ── Stage 2: Markdown → Exam (LLM + Instructor) ──────────────────────────
    _progress("extracting", "Extracting questions with LLM…")
    exam = extract(conversion.markdown, source_pdf=pdf_path)
    n_q = sum(len(e.questions) for e in exam.exercises)
    _progress(
        "extracting",
        f"Extracted {len(exam.exercises)} exercise(s), {n_q} question(s)",
        exercises=len(exam.exercises),
        questions=n_q,
    )

    # ── Stage 3: Validate + confidence score ─────────────────────────────────
    _progress("validating", "Validating and scoring quality…")
    exam = validate(exam, conversion.markdown)
    flag = "needs review" if exam.needs_review else "ok"
    _progress(
        "validating",
        f"Quality score: {exam.confidence:.0%} — {flag}",
        confidence=exam.confidence,
        needs_review=exam.needs_review,
    )

    # ── Stage 4: Bloom's cognitive level classification ───────────────────────
    _progress("classifying", "Classifying cognitive levels (Bloom's taxonomy)…")
    exam = evaluate_levels(exam)
    _progress("classifying", "Level classification done")

    # ── Stage 5: VLM for visual diagrams only (not structured tables) ─────────
    _progress("vision", "Describing visual diagrams…")
    exam = extract_and_describe(exam, pdf_path)
    _progress("vision", "Vision analysis done")

    # ── Save JSON ─────────────────────────────────────────────────────────────
    saved_to: str | None = None
    if output_dir is not None:
        out = Path(output_dir) / (path.stem + ".json")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(
            json.dumps(exam.model_dump(by_alias=True), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        saved_to = str(out)
        _progress("saving", f"Saved → {out}", saved_to=saved_to)

    return exam


def parse_pdf_to_markdown_only(pdf_path: str) -> str:
    """Utility: return the Markdown without calling the LLM (useful for inspection)."""
    result = convert_with_fallback(pdf_path)
    return result.markdown
