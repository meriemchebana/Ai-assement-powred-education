"""Exam Planner — translates a user request into a structured ExamPlan.

Uses the TemplateAnalyzer to discover the archive pattern for the subject,
then applies user overrides (n_exercises, total_points, duration, level, pattern).

Output: ExamPlan — a blueprint the Assembler consumes to call the generator.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from .template_analyzer import get_analyzer, PatternName

# ── Models ────────────────────────────────────────────────────────────────────

ExerciseKind = Literal["QCM", "PRACTICAL", "THEORY"]


class ExercisePlan(BaseModel):
    position: int
    kind: ExerciseKind
    n_questions: int
    points: float | None
    target_level: str        # e.g. "Procedural", "Conceptual", "Mixed"
    topic: str | None = None


class ExamPlan(BaseModel):
    subject: str
    title: str | None
    total_points: float | None
    duration_minutes: int | None
    exercises: list[ExercisePlan]
    template_hint: str       # compact hint injected into the prompt
    template_source: Literal["archive", "user_override", "default"]


class GenerateExamRequest(BaseModel):
    subject: str
    title: str | None = None
    # Optional overrides — if None, take from archive template
    n_exercises: int | None = Field(default=None, ge=1, le=8)
    duration_minutes: int | None = Field(default=None, ge=15, le=300)
    total_points: float | None = Field(default=None, gt=0)
    target_level: str = "Mixed"
    pattern_override: PatternName | None = None
    topic: str | None = None
    # Per-exercise kind override: list of kinds in order, e.g. ["THEORY","PRACTICAL","PRACTICAL"]
    exercise_kinds: list[ExerciseKind] | None = None
    teacher_id: int | None = None
    user_id: str | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

_PATTERN_TO_KINDS: dict[PatternName, list[ExerciseKind]] = {
    "all_QCM":              ["QCM"],
    "all_practical":        ["PRACTICAL"],
    "all_theory":           ["THEORY"],
    "theory_then_practical": ["THEORY", "PRACTICAL"],
    "qcm_then_practical":   ["QCM", "PRACTICAL"],
    "mixed":                ["PRACTICAL"],
}


def _kinds_for_plan(
    pattern: PatternName,
    n_exercises: int,
    user_kinds: list[ExerciseKind] | None,
) -> list[ExerciseKind]:
    """Return a kind list of length n_exercises."""
    if user_kinds:
        # Pad or trim to n_exercises
        base = list(user_kinds)
        while len(base) < n_exercises:
            base.append(base[-1])
        return base[:n_exercises]

    template = _PATTERN_TO_KINDS.get(pattern, ["PRACTICAL"])
    if len(template) == 1:
        return template * n_exercises

    # theory_then_practical / qcm_then_practical: first slot is special, rest are PRACTICAL
    first = template[0]
    rest: ExerciseKind = template[-1]
    result = [first] + [rest] * (n_exercises - 1)
    return result[:n_exercises]


def _distribute_points(
    total: float,
    blueprints_pts: list[float | None],
) -> list[float]:
    """Distribute total points across exercises using blueprint ratios or equal split."""
    known = [p for p in blueprints_pts if p is not None]
    n = len(blueprints_pts)
    if known:
        total_bp = sum(known)
        ratios = [(p / total_bp) if p else (1 / n) for p in blueprints_pts]
    else:
        ratios = [1 / n] * n

    raw = [total * r for r in ratios]
    # Round to nearest 0.5
    rounded = [round(v * 2) / 2 for v in raw]
    # Fix rounding drift on last element
    drift = total - sum(rounded[:-1])
    rounded[-1] = round(drift * 2) / 2
    return rounded


# ── Planner ───────────────────────────────────────────────────────────────────

class ExamPlanner:

    def plan(self, req: GenerateExamRequest) -> ExamPlan:
        analyzer = get_analyzer()
        tmpl = analyzer.get(req.subject)

        # ── Determine plan parameters ──────────────────────────────────────
        pattern: PatternName = (
            req.pattern_override
            or (tmpl.dominant_pattern if tmpl else "all_practical")
        )

        n_exercises: int = (
            req.n_exercises
            or (tmpl.n_exercises_typical if tmpl else 3)
        )

        duration: int | None = (
            req.duration_minutes
            or (tmpl.duration_minutes_typical if tmpl else None)
        )

        total_points: float | None = (
            req.total_points
            or (tmpl.total_points_typical if tmpl else None)
        )

        # ── Build per-exercise plans ───────────────────────────────────────
        kinds = _kinds_for_plan(pattern, n_exercises, req.exercise_kinds)

        # Blueprint points (may be None)
        bp_points: list[float | None] = []
        for i in range(n_exercises):
            if tmpl and i < len(tmpl.exercise_blueprints):
                bp_points.append(tmpl.exercise_blueprints[i].typical_points)
            else:
                bp_points.append(None)

        # Redistribute if user specified total
        if total_points:
            distributed = _distribute_points(total_points, bp_points)
        else:
            distributed = [p for p in bp_points]

        exercises: list[ExercisePlan] = []
        for i, kind in enumerate(kinds):
            # Question count
            if tmpl and i < len(tmpl.exercise_blueprints):
                bp = tmpl.exercise_blueprints[i]
                n_q = bp.typical_q_count
                bp_level = bp.dominant_level or "Procedural"
            else:
                n_q = 4 if kind == "QCM" else 3
                bp_level = "Procedural"

            # Target level: user override > blueprint > Procedural
            if req.target_level != "Mixed":
                target_level = req.target_level
            else:
                target_level = bp_level

            exercises.append(ExercisePlan(
                position=i + 1,
                kind=kind,
                n_questions=max(1, n_q),
                points=distributed[i] if distributed[i] else None,
                target_level=target_level,
                topic=req.topic,
            ))

        hint = analyzer.to_compact_hint(req.subject) if tmpl else f"[{req.subject}] no archive data"
        source = "archive" if tmpl and not req.pattern_override else (
            "user_override" if req.pattern_override else "default"
        )

        return ExamPlan(
            subject=req.subject,
            title=req.title,
            total_points=total_points,
            duration_minutes=duration,
            exercises=exercises,
            template_hint=hint,
            template_source=source,
        )


# ── Singleton ─────────────────────────────────────────────────────────────────

_planner: ExamPlanner | None = None


def get_planner() -> ExamPlanner:
    global _planner
    if _planner is None:
        _planner = ExamPlanner()
    return _planner
