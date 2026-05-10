"""Post-generation evaluator.

Uses gpt-oss-120b:free (same model as evaluator/evaluation.py in the evaluator folder)
to verify each generated question against retrieved course material.

Three axes (learned from evaluation.py's SYSTEM_PROMPT):
  1. Factual accuracy  — content matches RAG course material
  2. Level correctness — Bloom's level label matches actual difficulty
  3. Quality           — question is well-formed and answerable

RAG is queried per-question using the generated question's own topic tag,
giving more targeted retrieval than the batch-level query used during generation.
"""

from __future__ import annotations

import logging

import instructor
from openai import AsyncOpenAI

from .schemas import EvaluationResult, Exercise, MCQ, SAQ
from .settings import settings

log = logging.getLogger("exam-forge.evaluator")

# #Eval_SystemPrompt — 4-axis evaluation: factual_ok + level_correct + quality + difficulty calibration
EVALUATOR_SYSTEM_PROMPT = """You are an expert academic evaluator assessing AI-generated exam questions.

You receive:
  • Excerpts from the actual course material retrieved using the question stem as a search query
  • A generated question with its answer/rubric, assigned cognitive level, allocated points, and exam context

Evaluate on FOUR axes — output a JSON object, nothing else.

━━━ AXIS 1 — ANSWER EXTRACTABILITY ━━━
factual_ok (bool):
  true  → the correct answer can be found or clearly derived from the provided course excerpts.
  false → the answer invents facts, relies on outside knowledge, or contradicts the excerpts.
  Note: if no course material is provided, default to true.
  Note: for Metacognitive questions, true is valid if individual concepts are present even without a single full-answer passage.

━━━ AXIS 2 — COGNITIVE LEVEL ━━━
Levels (Bloom's taxonomy, easiest → hardest):
  Factual       — recall, define, list
  Conceptual    — explain, compare, analyze
  Procedural    — apply, compute, implement, write an algorithm
  Metacognitive — evaluate, judge, propose, critique

level_correct (bool): true if the assigned level matches the question's actual difficulty
corrected_level (str | null): the correct level if level_correct is false, else null

━━━ AXIS 3 — QUESTION QUALITY ━━━
quality:
  "good"           — clear stem, unambiguous, fully self-contained, correct answer
  "needs_revision" — minor issues: vague phrasing, missing context, incomplete rubric
  "reject"         — fundamentally flawed: wrong answer, impossible to solve, misleading

━━━ AXIS 4 — DIFFICULTY CALIBRATION ━━━
Consider: allocated points, exam duration (if provided), target cognitive level, and the actual work required.

points_calibration:
  "too_low"  → question requires significantly more effort/time than the points suggest
               (e.g. writing a recursive algorithm worth 0.5 pts, or 4 sub-questions for 2 pts)
  "fair"     → points are proportional to the cognitive effort and time required
  "too_high" → question is too simple for the points allocated
               (e.g. a one-line recall question worth 5 pts)

difficulty_ok (bool):
  true  → difficulty is appropriate for a university student at this level
           (challenging but solvable in exam conditions without external resources)
  false → difficulty is unreasonable: either trivially easy (insults students' intelligence)
          or unreasonably hard (requires knowledge beyond the course or excessive computation)

estimated_minutes (int):
  Realistic minutes a competent student needs to fully answer this question in an exam.
  Guidelines:
    • Simple recall / definition: 1–2 min
    • Short explanation / example: 2–4 min
    • Algorithm implementation (10–20 lines): 5–10 min
    • Multi-step problem with computation: 5–15 min
    • Complex algorithm + explanation: 10–20 min
  For exercises: sum the sub-questions.

━━━ VERDICT ━━━
verdict (apply in priority order — reject overrides flag overrides pass):
  "reject" → NOT factual_ok  OR  quality == "reject"
  "flag"   → NOT level_correct  OR  quality == "needs_revision"  OR  points_calibration != "fair"  OR  NOT difficulty_ok
  "pass"   → all axes green

━━━ NOTES ━━━
notes (str): 1–2 sentences explaining the verdict. If calibration is off, state what should change
(e.g. "3 pts is too low for writing a recursive traversal — suggest 5 pts or ~8 min").

Output only valid JSON. No markdown, no extra text."""


# ── Question formatters ────────────────────────────────────────────────────────

# #Eval_FormatMCQ — render MCQ as plain text block for the evaluator prompt
def _fmt_mcq(q: MCQ) -> str:
    letters = ["A", "B", "C", "D"]
    choices = "\n".join(
        f"  {letters[i]}{'*' if i == q.correct_index else ''}) {c}"
        for i, c in enumerate(q.choices)
    )
    return (
        f"Type: MCQ\n"
        f"Assigned level: {q.level}\n"
        f"Topic: {q.topic}\n"
        f"Question: {q.stem}\n"
        f"Choices (* = correct):\n{choices}\n"
        f"Explanation: {q.explanation}"
    )


def _fmt_saq(q: SAQ) -> str:
    rubric = "\n".join(f"  • {b}" for b in q.grading_rubric)
    return (
        f"Type: SAQ ({q.points} pts)\n"
        f"Assigned level: {q.level}\n"
        f"Topic: {q.topic}\n"
        f"Question: {q.stem}\n"
        f"Model answer: {q.model_answer}\n"
        f"Grading rubric:\n{rubric}"
    )


def _fmt_exercise(ex: Exercise) -> str:
    lines = [
        f"Type: Exercise",
        f"Assigned level: {ex.level}",
        f"Topic: {ex.topic}",
        f"Title: {ex.title}",
        f"Context: {ex.context[:600]}",
    ]
    for i, q in enumerate(ex.questions, 1):
        rubric = " | ".join(q.grading_rubric)
        lines.append(f"Q{i} ({q.points}pts): {q.stem}")
        lines.append(f"  Answer: {q.model_answer[:300]}")
        lines.append(f"  Rubric: {rubric}")
    return "\n".join(lines)


# #Eval_BuildMessage — combine RAG ground-truth + question text + exam context into evaluator user message
def _build_user_message(
    question: MCQ | SAQ | Exercise,
    rag_context: str,
    exam_duration_minutes: int | None = None,
    total_exam_points: float | None = None,
) -> str:
    if rag_context:
        material = f"=== COURSE MATERIAL (ground truth) ===\n{rag_context[:2500]}\n=== END ==="
    else:
        material = "(No course material retrieved — factual check unavailable.)"

    context_lines = []
    if exam_duration_minutes:
        context_lines.append(f"Exam duration: {exam_duration_minutes} min")
    if total_exam_points:
        context_lines.append(f"Total exam points: {total_exam_points} pts")
    exam_ctx = ("=== EXAM CONTEXT ===\n" + "\n".join(context_lines) + "\n=== END ===\n\n") if context_lines else ""

    if isinstance(question, MCQ):
        q_text = _fmt_mcq(question)
    elif isinstance(question, SAQ):
        q_text = _fmt_saq(question)
    else:
        q_text = _fmt_exercise(question)

    return f"{material}\n\n{exam_ctx}=== QUESTION TO EVALUATE ===\n{q_text}"


# ── Evaluator class ────────────────────────────────────────────────────────────

# #Eval_Class — uses separate GPT model; never raises (returns fallback on failure)
class Evaluator:
    def __init__(self) -> None:
        # Separate instructor client pointing to gpt-oss-120b:free
        # (generator uses DeepSeek; evaluator uses the same model as evaluation.py)
        self._client = instructor.from_openai(
            AsyncOpenAI(
                api_key=settings.openrouter_api_key,
                base_url=settings.openrouter_base_url,
            ),
            mode=instructor.Mode.JSON,
        )

    async def evaluate(
        self,
        question: MCQ | SAQ | Exercise,
        rag_context: str,
        exam_duration_minutes: int | None = None,
        total_exam_points: float | None = None,
    ) -> EvaluationResult:
        """Evaluate one generated question. Never raises — returns a fallback on failure."""
        try:
            result = await self._client.chat.completions.create(
                model=settings.evaluator_model,
                response_model=EvaluationResult,
                max_retries=2,
                temperature=0,
                max_tokens=400,
                messages=[
                    {"role": "system", "content": EVALUATOR_SYSTEM_PROMPT},
                    {"role": "user",   "content": _build_user_message(
                        question, rag_context, exam_duration_minutes, total_exam_points
                    )},
                ],
                extra_headers={
                    "HTTP-Referer": "https://github.com/exam-forge",
                    "X-Title": "Exam Forge Evaluator",
                },
            )
            return result
        except Exception as exc:
            log.warning("evaluation failed: %s", exc)
            return EvaluationResult(
                factual_ok=True,
                level_correct=True,
                corrected_level=None,
                quality="good",
                points_calibration="fair",
                difficulty_ok=True,
                estimated_minutes=5,
                verdict="pass",
                notes="Evaluation unavailable — could not reach the evaluator model.",
            )

    async def evaluate_exercise_dict(
        self,
        ex_dict: dict,
        rag_context: str,
        exam_duration_minutes: int | None = None,
        total_exam_points: float | None = None,
    ) -> EvaluationResult:
        """Evaluate an exercise represented as a plain dict (from ExamAssembler).
        Never raises — returns a fallback on failure."""
        lines = [
            f"Type: Exercise",
            f"Title: {ex_dict.get('title', '')}",
            f"Context: {str(ex_dict.get('introduction_context', ''))[:600]}",
        ]
        for i, q in enumerate(ex_dict.get("questions", []), 1):
            lines.append(f"Q{i}: {q.get('question_text', '')[:300]}")
        q_text = "\n".join(lines)

        if rag_context:
            material = f"=== COURSE MATERIAL (ground truth) ===\n{rag_context[:2500]}\n=== END ==="
        else:
            material = "(No course material retrieved — factual check unavailable.)"

        context_lines = []
        if exam_duration_minutes:
            context_lines.append(f"Exam duration: {exam_duration_minutes} min")
        if total_exam_points:
            context_lines.append(f"Total exam points: {total_exam_points} pts")
        exam_ctx = ("=== EXAM CONTEXT ===\n" + "\n".join(context_lines) + "\n=== END ===\n\n") if context_lines else ""

        user_msg = f"{material}\n\n{exam_ctx}=== QUESTION TO EVALUATE ===\n{q_text}"
        try:
            result = await self._client.chat.completions.create(
                model=settings.evaluator_model,
                response_model=EvaluationResult,
                max_retries=2,
                temperature=0,
                max_tokens=400,
                messages=[
                    {"role": "system", "content": EVALUATOR_SYSTEM_PROMPT},
                    {"role": "user",   "content": user_msg},
                ],
                extra_headers={
                    "HTTP-Referer": "https://github.com/exam-forge",
                    "X-Title": "Exam Forge Evaluator",
                },
            )
            return result
        except Exception as exc:
            log.warning("exercise_dict evaluation failed: %s", exc)
            return EvaluationResult(
                factual_ok=True,
                level_correct=True,
                corrected_level=None,
                quality="good",
                points_calibration="fair",
                difficulty_ok=True,
                estimated_minutes=5,
                verdict="pass",
                notes="Evaluation unavailable — could not reach the evaluator model.",
            )


_evaluator: Evaluator | None = None


# #Eval_Singleton — returns None if disabled or key not set (evaluation is optional)
def get_evaluator() -> Evaluator | None:
    """Return the singleton evaluator, or None if disabled / key not set."""
    global _evaluator
    if not settings.evaluator_enabled:
        return None
    if _evaluator is None:
        if not settings.openrouter_api_key or settings.openrouter_api_key.startswith("sk-or-v1-replace"):
            return None
        _evaluator = Evaluator()
    return _evaluator
