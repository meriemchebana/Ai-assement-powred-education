"""Exam Assembler — executes an ExamPlan by calling the generator for each exercise,
then assembles results into a dataset-compatible exam JSON.

Streaming via async generator of SSE-ready dicts.
"""

from __future__ import annotations

import logging
from typing import AsyncIterator

from .dataset import Dataset
from .evaluator import Evaluator
from .exam_planner import ExamPlan, ExercisePlan
from .generator import Generator
try:
    from .rag.indexer import RAGIndexer
except ImportError:
    RAGIndexer = None  # type: ignore[assignment,misc]
from .schemas import MCQ, SAQ, Exercise

log = logging.getLogger("exam-forge")

# ── Dataset schema helpers ────────────────────────────────────────────────────

def _mcq_to_question(mcq: MCQ, idx: int, ex_id: str) -> dict:
    return {
        "id": f"{ex_id}_q{idx}",
        "type": "QCM",
        "question_text": mcq.stem,
        "choices": mcq.choices,
        "solution": {"text": str(mcq.correct_index), "explanation": mcq.explanation},
        "level": mcq.level,
        "points": 1.0,
        "topic": mcq.topic,
    }


def _saq_to_question(saq: SAQ, idx: int, ex_id: str) -> dict:
    return {
        "id": f"{ex_id}_q{idx}",
        "type": "FREE",
        "question_text": saq.stem,
        "solution": {"text": saq.model_answer, "rubric": saq.grading_rubric},
        "level": saq.level,
        "points": float(saq.points),
        "topic": saq.topic,
    }


def _exercise_to_dict(ex: Exercise, position: int, points: float | None) -> dict:
    ex_id = f"ex{position:02d}"
    raw_pts = [float(q.points) for q in ex.questions]
    raw_total = sum(raw_pts)

    # Rescale question points to match the plan's allocated total
    if points and raw_total > 0:
        scale = points / raw_total
        scaled = [round(p * scale * 2) / 2 for p in raw_pts]
        # Fix drift on last question
        drift = points - sum(scaled[:-1])
        scaled[-1] = round(drift * 2) / 2
    else:
        scaled = raw_pts

    questions = []
    for i, (q, pts) in enumerate(zip(ex.questions, scaled), 1):
        questions.append({
            "id": f"{ex_id}_q{i}",
            "type": "FREE",
            "question_text": q.stem,
            "solution": {"text": q.model_answer, "rubric": q.grading_rubric},
            "points": pts,
            "topic": ex.topic,
        })
    return {
        "id": ex_id,
        "title": ex.title,
        "total_exercise_points": points or raw_total,
        "introduction_context": ex.context,
        "questions": questions,
        "level": ex.level,
    }


def _mcqs_to_exercise_dict(mcqs: list[MCQ], position: int, points: float | None) -> dict:
    ex_id = f"ex{position:02d}"
    pt_each = round((points / len(mcqs)) * 2) / 2 if points else 1.0
    questions = [_mcq_to_question(m, i, ex_id) for i, m in enumerate(mcqs, 1)]
    for q in questions:
        q["points"] = pt_each
    return {
        "id": ex_id,
        "title": f"QCM — Exercise {position}",
        "total_exercise_points": points,
        "introduction_context": None,
        "questions": questions,
    }


def _saqs_to_exercise_dict(saqs: list[SAQ], position: int, points: float | None, title: str) -> dict:
    ex_id = f"ex{position:02d}"
    questions = [_saq_to_question(s, i, ex_id) for i, s in enumerate(saqs, 1)]
    total = sum(q["points"] for q in questions)
    return {
        "id": ex_id,
        "title": title or f"Questions de cours — Exercise {position}",
        "total_exercise_points": points or total,
        "introduction_context": None,
        "questions": questions,
    }


# ── Assembler ─────────────────────────────────────────────────────────────────

class ExamAssembler:

    async def assemble(
        self,
        plan: ExamPlan,
        *,
        generator: Generator,
        dataset: Dataset,
        rag: RAGIndexer | None,
        evaluator: Evaluator | None = None,
    ) -> AsyncIterator[dict]:
        """Yield SSE-ready event dicts as each exercise is generated."""

        subject = plan.subject
        hint = plan.template_hint
        seen_titles: list[str] = []
        seen_stems: list[str] = []
        assembled_exercises: list[dict] = []
        exam_idx = 0  # 0-based index matching frontend array position

        yield {"event": "plan", "data": {
            "subject": subject,
            "n_exercises": len(plan.exercises),
            "total_points": plan.total_points,
            "duration_minutes": plan.duration_minutes,
            "template_hint": hint,
            "template_source": plan.template_source,
        }}

        for ep in plan.exercises:
            yield {"event": "status", "data": {
                "phase": "generating",
                "message": f"Generating exercise {ep.position}/{len(plan.exercises)} "
                           f"({ep.kind}, {ep.n_questions} questions, level={ep.target_level})",
            }}

            rag_context: str | None = None
            if rag is not None:
                query = ep.topic or subject
                rag_context = rag.query(subject, query, top_k=5) or None

            effective_level = ep.target_level if ep.target_level != "Mixed" else "Procedural"

            try:
                ex_dict = await self._generate_exercise(
                    ep=ep,
                    subject=subject,
                    effective_level=effective_level,
                    dataset=dataset,
                    generator=generator,
                    rag_context=rag_context,
                    seen_titles=seen_titles,
                    seen_stems=seen_stems,
                    hint=hint,
                )
            except Exception as e:
                log.exception("Exercise %d generation failed", ep.position)
                yield {"event": "error", "data": {
                    "exercise": ep.position,
                    "message": str(e),
                }}
                continue

            assembled_exercises.append(ex_dict)

            # Track to avoid repetition in next exercises
            title = ex_dict.get("title", "")
            if title:
                seen_titles.append(title)
            for q in ex_dict.get("questions", []):
                stem = q.get("question_text", "")[:120]
                if stem:
                    seen_stems.append(stem)

            yield {"event": "exercise", "data": {
                "position": ep.position,
                "exercise": ex_dict,
            }}

            # Evaluate the exercise and send feedback so the frontend can show
            # the "↻ Regen with critique" button when verdict is reject/flag.
            if evaluator:
                try:
                    eval_query = ex_dict.get("introduction_context", "")[:300] or ex_dict.get("title", subject)
                    q_rag = rag.query(subject, eval_query, top_k=5) if rag else ""
                    ev = await evaluator.evaluate_exercise_dict(
                        ex_dict, q_rag or "",
                        exam_duration_minutes=plan.duration_minutes,
                        total_exam_points=plan.total_points,
                    )
                    yield {"event": "evaluation", "data": {"idx": exam_idx, "result": ev.model_dump()}}
                except Exception:
                    log.warning("Evaluator failed for exercise %d — skipping", ep.position)

            exam_idx += 1

        # Assemble final exam JSON
        duration_str: str | None = None
        if plan.duration_minutes:
            h, m = divmod(plan.duration_minutes, 60)
            duration_str = f"{h}h{m:02d}" if m else f"{h}h"

        exam_json = {
            "metadata": {
                "module": subject,
                "language": "french",
                "duration": duration_str or "",
            },
            "exercises": assembled_exercises,
        }

        yield {"event": "done", "data": {
            "total_exercises": len(assembled_exercises),
            "exam": exam_json,
        }}

    async def _generate_exercise(
        self,
        *,
        ep: ExercisePlan,
        subject: str,
        effective_level: str,
        dataset: Dataset,
        generator: Generator,
        rag_context: str | None,
        seen_titles: list[str],
        seen_stems: list[str],
        hint: str,
    ) -> dict:

        if ep.kind == "QCM":
            examples = dataset.sample_by_topic(subject, effective_level, ep.topic, n=4)
            mcqs: list[MCQ] = []
            for _ in range(ep.n_questions):
                mcq = await generator.generate_mcq(
                    subject=subject,
                    level=effective_level,
                    topic=ep.topic,
                    examples=examples,
                    already_generated_stems=seen_stems + [m.stem for m in mcqs],
                    rag_context=_inject_hint(rag_context, hint),
                )
                mcqs.append(mcq)
            return _mcqs_to_exercise_dict(mcqs, ep.position, ep.points)

        if ep.kind == "THEORY":
            examples = dataset.sample_by_topic(subject, effective_level, ep.topic, n=4)
            saqs: list[SAQ] = []
            for _ in range(ep.n_questions):
                saq = await generator.generate_saq(
                    subject=subject,
                    level=effective_level,
                    topic=ep.topic,
                    examples=examples,
                    already_generated_stems=seen_stems + [s.stem for s in saqs],
                    rag_context=_inject_hint(rag_context, hint),
                )
                saqs.append(saq)
            return _saqs_to_exercise_dict(saqs, ep.position, ep.points, "Questions de cours")

        # PRACTICAL — generate a structured exercise
        ex_examples = dataset.sample_exercises_by_topic(subject, ep.topic, n=3)
        exercise: Exercise = await generator.generate_exercise(
            subject=subject,
            level=effective_level,
            topic=ep.topic,
            n_questions=ep.n_questions,
            total_points=ep.points,
            examples=ex_examples,
            already_generated_titles=seen_titles,
            rag_context=_inject_hint(rag_context, hint),
        )
        return _exercise_to_dict(exercise, ep.position, ep.points)


def _inject_hint(rag_context: str | None, hint: str) -> str:
    """Prepend compact template hint to RAG context for the generator."""
    prefix = f"[Exam template] {hint}\n\n"
    return prefix + (rag_context or "")


# ── Singleton ─────────────────────────────────────────────────────────────────

_assembler: ExamAssembler | None = None


def get_assembler() -> ExamAssembler:
    global _assembler
    if _assembler is None:
        _assembler = ExamAssembler()
    return _assembler
