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
from docParser.convert.docling_convert import convert_with_fallback
from docParser.extract.llm_extract import extract
from docParser.validate.validator import validate
from docParser.evaluate.level_eval import evaluate_levels
from docParser.vision.vlm_describe import extract_and_describe
from docParser.schema.exam import Exam


def parse_pdf(pdf_path: str, output_dir: str | None = None) -> Exam:
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(pdf_path)

    # ── Stage 1: PDF → Markdown ───────────────────────────────────────────────
    print(f"[stage1] Converting PDF → Markdown  ({path.name})")
    conversion = convert_with_fallback(pdf_path)
    print(
        f"[stage1] Done — {conversion.page_count} pages, "
        f"tables={'yes' if conversion.has_tables else 'no'}, "
        f"source={conversion.source}"
    )

    # ── Stage 2: Markdown → Exam (LLM + Instructor) ──────────────────────────
    print("[stage2] Extracting structured data via LLM …")
    exam = extract(conversion.markdown, source_pdf=pdf_path)
    print(
        f"[stage2] Done — {len(exam.exercises)} exercise(s), "
        f"{sum(len(e.questions) for e in exam.exercises)} question(s)"
    )

    # ── Stage 3: Validate + confidence score ─────────────────────────────────
    print("[stage3] Validating …")
    exam = validate(exam, conversion.markdown)
    flag = "⚠ needs review" if exam.needs_review else "✓ ok"
    print(f"[stage3] Confidence={exam.confidence:.0%}  {flag}")

    # ── Stage 4: Bloom's cognitive level classification ───────────────────────
    exam = evaluate_levels(exam)

    # ── Stage 5: VLM for visual diagrams only (not structured tables) ─────────
    exam = extract_and_describe(exam, pdf_path)

    # ── Save JSON ─────────────────────────────────────────────────────────────
    if output_dir is not None:
        out = Path(output_dir) / (path.stem + ".json")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(
            json.dumps(exam.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"[output] Saved → {out}")

    return exam


def parse_pdf_to_markdown_only(pdf_path: str) -> str:
    """Utility: return the Markdown without calling the LLM (useful for inspection)."""
    result = convert_with_fallback(pdf_path)
    return result.markdown
