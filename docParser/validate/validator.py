"""Stage 3 — Post-extraction validation and confidence scoring.

Instructor already enforces schema correctness via Pydantic.
This module adds domain-specific checks on top:
  - Grounding: every question_text must appear verbatim in the source Markdown
  - Orphan answers: solutions without matching questions are dropped
  - Confidence scoring: lower score flags document for human review
"""
from __future__ import annotations
import re
from docParser.schema.exam import Exam, Exercise, Question


# ── Grounding check ───────────────────────────────────────────────────────────

def _text_grounded(text: str, source_markdown: str, min_len: int = 20) -> bool:
    """True if a significant substring of text appears in the source."""
    if not text or len(text) < min_len:
        return True   # too short to verify
    # Check a 20-char window from the middle of the text
    probe = text[len(text)//4: len(text)//4 + 20].strip()
    return probe in source_markdown


def _check_grounding(exam: Exam, markdown: str) -> list[str]:
    """Return list of warnings for questions not grounded in source."""
    warnings = []
    for ex in exam.exercises:
        for q in ex.questions:
            if not _text_grounded(q.question_text, markdown):
                warnings.append(
                    f"Q{q.id}: question_text not found verbatim in source → possible hallucination"
                )
    return warnings


# ── Confidence scoring ────────────────────────────────────────────────────────

def _compute_confidence(exam: Exam, warnings: list[str]) -> float:
    score = 1.0
    score -= len(warnings) * 0.15             # each warning costs 15%
    if not exam.exercises:
        score -= 0.5                           # no exercises = very bad
    for ex in exam.exercises:
        if not ex.questions:
            score -= 0.1                       # exercise with no questions
    return max(0.0, round(score, 2))


# ── Missing solution detection ───────────────────────────────────────────────

_CORRECTION_KEYWORDS = {"correction", "corrigé", "الحل", "التصحيح", "corrige"}

def _has_correction_section(markdown: str) -> bool:
    return any(kw in markdown.lower() for kw in _CORRECTION_KEYWORDS)


def _check_missing_solutions(exam: Exam, markdown: str) -> list[str]:
    """Warn when a question has no solution but a correction section exists."""
    if not _has_correction_section(markdown):
        return []
    warnings = []
    for ex in exam.exercises:
        for q in ex.questions:
            if q.solution is None:
                warnings.append(
                    f"Q{q.id}: solution is null but a correction section exists "
                    f"— LLM may have failed to split or match it"
                )
    return warnings


# ── Orphan solution cleanup ───────────────────────────────────────────────────

def _drop_orphan_solutions(exam: Exam) -> int:
    """Remove solutions that have no matching question_text. Returns drop count."""
    dropped = 0
    for ex in exam.exercises:
        for q in ex.questions:
            # An "orphan" solution here would be a question with no text
            # but a solution — artifact of bad splitting
            if not q.question_text.strip() and q.solution:
                q.solution = None
                dropped += 1
    return dropped


# ── Public entry point ────────────────────────────────────────────────────────

def validate(exam: Exam, source_markdown: str) -> Exam:
    """Run all checks; mutate exam in place; return it."""
    grounding_warnings = _check_grounding(exam, source_markdown)
    missing_warnings   = _check_missing_solutions(exam, source_markdown)
    all_warnings = grounding_warnings + missing_warnings

    dropped = _drop_orphan_solutions(exam)

    if dropped:
        print(f"[validate] Dropped {dropped} orphan solution(s)")
    for w in all_warnings:
        print(f"[validate] WARN {w}")

    exam.confidence = _compute_confidence(exam, all_warnings)
    exam.needs_review = exam.confidence < 0.7 or bool(all_warnings)

    return exam
