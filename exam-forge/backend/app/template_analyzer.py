"""Discovers exam templates from the labeled dataset archive.

Exercise types (fine-grained):
  QCM       – multiple-choice questions (choices field present)
  THEORY    – course / lecture questions (define, explain, cite…)
  PRACTICAL – algorithmic / problem-solving exercises
  MIXED     – QCM + open questions in the same exercise
  UNKNOWN   – empty or unreadable exercise

Exam pattern names:
  all_QCM              – entire exam is QCM (e.g. Médecine)
  all_practical        – all exercises are problem-solving (e.g. Algo, Compilation)
  all_theory           – all exercises are theory questions (e.g. Law)
  theory_then_practical – course-questions part followed by practical exercises (e.g. SE)
  qcm_then_practical   – QCM section then open exercises
  mixed                – other combinations
"""

from __future__ import annotations

import glob
import json
import logging
import os
import re
from collections import Counter
from pathlib import Path
from statistics import median
from typing import Literal

from pydantic import BaseModel

log = logging.getLogger("exam-forge")

# ── Types ────────────────────────────────────────────────────────────────────

ExerciseType = Literal["QCM", "THEORY", "PRACTICAL", "MIXED", "UNKNOWN"]
PatternName  = Literal[
    "all_QCM",
    "all_practical",
    "all_theory",
    "theory_then_practical",
    "qcm_then_practical",
    "mixed",
]

# ── Pydantic models ──────────────────────────────────────────────────────────

class ExerciseBlueprint(BaseModel):
    position: int
    type: ExerciseType
    typical_q_count: int
    typical_points: float | None
    dominant_level: str | None              # most frequent Bloom level at this position
    level_distribution: dict[str, float]    # level → % of questions at this position


class SubjectTemplate(BaseModel):
    subject: str
    dominant_pattern: PatternName
    n_exercises_typical: int
    total_points_typical: float | None
    duration_minutes_typical: int | None
    exercise_blueprints: list[ExerciseBlueprint]
    confidence: float                           # fraction of exams with the typical exercise count
    n_exams_analyzed: int
    exam_dominant_level: str | None             # most frequent level across the whole exam
    exam_level_distribution: dict[str, float]   # level → % across all exam questions


# ── Detection helpers ─────────────────────────────────────────────────────────

_THEORY_TITLE_RE = re.compile(
    r"cours|théori|lecture|general|نظري|محاضرة|مقرر",
    re.IGNORECASE,
)

_THEORY_Q_KEYWORDS = [
    # French
    "définir", "définissez", "définition", "expliquer", "expliquez",
    "qu'est-ce", "qu est", "citer", "citez", "donner une définition",
    "vrai ou faux", "indiquer", "indiquez", "décrire", "décrivez",
    "donner les avantages", "rôle de", "caractéristique", "propriété",
    "comparer", "avantage", "inconvénient", "différence entre",
    "rappelez", "présentez brièvement", "expliquer le principe",
    # Arabic
    "عرّف", "عرف", "اذكر",
    "صح أم خطأ", "صواب أم خطأ", "أشرح", "قارن",
    # Arabic "ما هو/ما هي" only when NOT followed by a math term
    # (handled separately in _is_theory_question)
]

# "ما هو/ما هي" triggers THEORY only when the sentence has no mathematical content
_ARABIC_WHAT_IS_RE  = re.compile(r"ما\s+ه[وي]")
_MATH_CONTENT_RE    = re.compile(r"[=\+\-\*/\\∑∏∫√]|توزيع|احسب|حساب|قيمة|نتيجة|\d")

_PRACTICAL_MARKERS = re.compile(
    r"pseudocode|algorithme|algorithm|tableau|graph|automate|grammaire"
    r"|compilat|semaphor|sémaphor|mutex|processus|ressource",
    re.IGNORECASE,
)


def _get_questions(exercise: dict) -> list[dict]:
    """Return top-level question/part list (used for type detection)."""
    for key in ("questions", "Question", "parts"):
        v = exercise.get(key)
        if isinstance(v, list):
            return v
    if "question_text" in exercise:
        return [exercise]
    return []


_NESTED_KEYS = ("Question", "questions", "parts", "sub_questions")


def _get_leaf_questions(node: dict) -> list[dict]:
    """Recursively return only leaf questions (no nested children) from any node."""
    children_lists = [
        node[k] for k in _NESTED_KEYS
        if isinstance(node.get(k), list) and node[k]
    ]
    if not children_lists:
        return [node] if "question_text" in node or "level" in node else []
    leaves: list[dict] = []
    for lst in children_lists:
        for child in lst:
            if isinstance(child, dict):
                leaves.extend(_get_leaf_questions(child))
    return leaves


def _is_theory_question(q: dict) -> bool:
    txt = (q.get("question_text") or "").lower()
    raw = q.get("question_text") or ""
    if any(kw in txt for kw in _THEORY_Q_KEYWORDS):
        return True
    # "ما هو / ما هي" → THEORY only when no math content in the sentence
    if _ARABIC_WHAT_IS_RE.search(raw) and not _MATH_CONTENT_RE.search(raw):
        return True
    return False


def _classify_exercise(exercise: dict) -> ExerciseType:
    qs = _get_questions(exercise)
    if not qs:
        return "UNKNOWN"

    # ── QCM check ──
    qcm_count = sum(
        1 for q in qs
        if q.get("type") in ("QCM", "MCQ")
        or (isinstance(q.get("choices"), list) and q["choices"])
    )
    open_count = len(qs) - qcm_count

    if qcm_count == len(qs):
        return "QCM"
    if qcm_count > 0 and open_count > 0:
        return "MIXED"

    # ── All open: THEORY vs PRACTICAL ──
    title = exercise.get("title", "") or ""
    if _THEORY_TITLE_RE.search(title):
        return "THEORY"

    theory_q_count = sum(1 for q in qs if _is_theory_question(q))
    if theory_q_count / len(qs) >= 0.5:
        return "THEORY"

    # Check for practical markers in the full exercise blob
    ex_text = json.dumps(exercise, ensure_ascii=False)
    if _PRACTICAL_MARKERS.search(ex_text):
        return "PRACTICAL"

    # Default open → PRACTICAL (most open exercises in this dataset are problems)
    return "PRACTICAL"


# ── Pattern inference ─────────────────────────────────────────────────────────

def _dominant_pattern(sequences: list[tuple[str, ...]]) -> PatternName:
    if not sequences:
        return "all_practical"

    n = len(sequences)

    def _ratio(pred) -> float:
        return sum(1 for s in sequences if s and pred(s)) / n

    if _ratio(lambda s: all(t == "QCM"     for t in s)) >= 0.6:
        return "all_QCM"
    if _ratio(lambda s: all(t == "PRACTICAL" for t in s)) >= 0.5:
        return "all_practical"
    if _ratio(lambda s: all(t in ("THEORY", "UNKNOWN") for t in s)) >= 0.5:
        return "all_theory"
    if _ratio(lambda s: s[0] == "THEORY" and any(t == "PRACTICAL" for t in s[1:])) >= 0.3:
        return "theory_then_practical"
    if _ratio(lambda s: s[0] == "QCM"    and any(t == "PRACTICAL" for t in s[1:])) >= 0.3:
        return "qcm_then_practical"
    return "mixed"


# ── Misc helpers ──────────────────────────────────────────────────────────────

def _parse_duration_minutes(raw: str | None) -> int | None:
    if not raw or not isinstance(raw, str):
        return None
    raw = raw.strip()
    range_m = re.match(r"(\d{1,2})h(\d{0,2})\s*[-–]\s*(\d{1,2})h(\d{0,2})", raw, re.I)
    if range_m:
        h1, m1, h2, m2 = (int(x or 0) for x in range_m.groups())
        return (h2 * 60 + m2) - (h1 * 60 + m1)
    h_m = re.search(r"(\d+)\s*h(\d{2})?", raw, re.I)
    if h_m:
        h = int(h_m.group(1))
        m = int(h_m.group(2)) if h_m.group(2) else 0
        min_m = re.search(r"(\d+)\s*min", raw, re.I)
        if min_m:
            m = int(min_m.group(1))
        total = h * 60 + m
        return total or None
    min_m = re.search(r"(\d+)\s*min", raw, re.I)
    return int(min_m.group(1)) if min_m else None


def _safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        m = re.search(r"\d+(?:[.,]\d+)?", str(val))
        return float(m.group().replace(",", ".")) if m else None


def _median_int(values: list[int]) -> int:
    return int(median(values)) if values else 0


def _median_float(values: list[float]) -> float | None:
    return round(median(values), 1) if values else None


def _level_stats(counter: Counter) -> tuple[str | None, dict[str, float]]:
    """Return (dominant_level, {level: pct}) from a level Counter."""
    total = counter.total()
    if not total:
        return None, {}
    dominant = counter.most_common(1)[0][0]
    dist = {lvl: round(cnt / total * 100, 1) for lvl, cnt in counter.most_common()}
    return dominant, dist


def _collect_levels(exercise: dict) -> list[str]:
    """Collect Bloom levels from all leaf questions in an exercise."""
    return [
        q["level"]
        for q in _get_leaf_questions(exercise)
        if isinstance(q.get("level"), str)
    ]


# ── Main analyzer ─────────────────────────────────────────────────────────────

class TemplateAnalyzer:
    def __init__(self, data_dir: str | Path) -> None:
        self._data_dir = Path(data_dir)
        self._cache: dict[str, SubjectTemplate] = {}

    def _scan_subject(self, subject: str) -> SubjectTemplate | None:
        subject_path = self._data_dir / subject
        if not subject_path.is_dir():
            return None
        json_files = glob.glob(str(subject_path / "**" / "*.json"), recursive=True)
        if not json_files:
            return None

        type_sequences:    list[tuple[str, ...]] = []
        n_exercise_list:   list[int]   = []
        duration_list:     list[int]   = []
        total_points_list: list[float] = []
        pos_q_counts: dict[int, list[int]]   = {}
        pos_points:   dict[int, list[float]] = {}
        pos_types:    dict[int, list[str]]   = {}
        pos_levels:   dict[int, Counter]     = {}   # position → level counter
        exam_levels:  Counter                = Counter()  # global level counter

        for fpath in json_files:
            try:
                with open(fpath, encoding="utf-8") as fp:
                    data = json.load(fp)
            except Exception:
                continue

            exercises = data.get("exercises")
            if not isinstance(exercises, list) or not exercises:
                continue

            dur = _parse_duration_minutes(data.get("metadata", {}).get("duration"))
            if dur:
                duration_list.append(dur)

            ex_types: list[str] = []
            exam_points = 0.0

            for i, ex in enumerate(exercises):
                pos = i + 1
                ex_type = _classify_exercise(ex)
                ex_types.append(ex_type)

                qs = _get_leaf_questions(ex)
                if qs:
                    pos_q_counts.setdefault(pos, []).append(len(qs))

                pts = _safe_float(
                    ex.get("total_exercise_points") or ex.get("total_points")
                )
                if pts:
                    pos_points.setdefault(pos, []).append(pts)
                    exam_points += pts

                pos_types.setdefault(pos, []).append(ex_type)

                # Bloom levels
                lvls = _collect_levels(ex)
                if lvls:
                    if pos not in pos_levels:
                        pos_levels[pos] = Counter()
                    pos_levels[pos].update(lvls)
                    exam_levels.update(lvls)

            type_sequences.append(tuple(ex_types))
            n_exercise_list.append(len(exercises))
            if exam_points > 0:
                total_points_list.append(exam_points)

        if not type_sequences:
            return None

        n_typical  = _median_int(n_exercise_list)
        pattern    = _dominant_pattern(type_sequences)
        confidence = Counter(n_exercise_list)[n_typical] / len(n_exercise_list)

        blueprints: list[ExerciseBlueprint] = []
        for pos in range(1, n_typical + 1):
            types_at_pos = pos_types.get(pos, [])
            dominant: ExerciseType = (
                Counter(types_at_pos).most_common(1)[0][0]
                if types_at_pos else "PRACTICAL"
            )
            dom_lvl, lvl_dist = _level_stats(pos_levels.get(pos, Counter()))
            blueprints.append(ExerciseBlueprint(
                position=pos,
                type=dominant,
                typical_q_count=_median_int(pos_q_counts.get(pos, [1])),
                typical_points=_median_float(pos_points.get(pos, [])),
                dominant_level=dom_lvl,
                level_distribution=lvl_dist,
            ))

        exam_dom_lvl, exam_lvl_dist = _level_stats(exam_levels)

        return SubjectTemplate(
            subject=subject,
            dominant_pattern=pattern,
            n_exercises_typical=n_typical,
            total_points_typical=_median_float(total_points_list),
            duration_minutes_typical=_median_int(duration_list) or None,
            exercise_blueprints=blueprints,
            confidence=round(confidence, 2),
            n_exams_analyzed=len(type_sequences),
            exam_dominant_level=exam_dom_lvl,
            exam_level_distribution=exam_lvl_dist,
        )

    def get(self, subject: str) -> SubjectTemplate | None:
        if subject not in self._cache:
            result = self._scan_subject(subject)
            if result:
                self._cache[subject] = result
        return self._cache.get(subject)

    def all(self) -> dict[str, SubjectTemplate]:
        for subj in os.listdir(self._data_dir):
            if (self._data_dir / subj).is_dir():
                self.get(subj)
        return dict(self._cache)

    def to_compact_hint(self, subject: str) -> str:
        """Single-line template summary for LLM prompt injection."""
        tmpl = self.get(subject)
        if not tmpl:
            return ""

        parts = [f"[{subject}]", f"pattern={tmpl.dominant_pattern}"]

        summary = f"{tmpl.n_exercises_typical}ex"
        if tmpl.duration_minutes_typical:
            summary += f"/{tmpl.duration_minutes_typical}min"
        if tmpl.total_points_typical:
            summary += f"/{tmpl.total_points_typical}pts"
        parts.append(summary)

        if tmpl.exam_dominant_level:
            top2 = list(tmpl.exam_level_distribution.items())[:2]
            diff = "+".join(f"{l}({p}%)" for l, p in top2)
            parts.append(f"difficulty={diff}")

        for bp in tmpl.exercise_blueprints:
            pts = f",{bp.typical_points}pts" if bp.typical_points else ""
            lvl = f",{bp.dominant_level}" if bp.dominant_level else ""
            parts.append(f"ex{bp.position}:{bp.type},{bp.typical_q_count}q{pts}{lvl}")

        return " | ".join(parts)

    def to_prompt_hint(self, subject: str) -> str:
        tmpl = self.get(subject)
        if not tmpl:
            return ""
        lines = [
            f"Archive analysis for subject '{subject}' ({tmpl.n_exams_analyzed} exams):",
            f"  Pattern : {tmpl.dominant_pattern} (confidence on exercise count: {tmpl.confidence:.0%})",
            f"  Typical exam: {tmpl.n_exercises_typical} exercise(s)",
        ]
        if tmpl.total_points_typical:
            lines.append(f"  Typical total points: {tmpl.total_points_typical}")
        if tmpl.duration_minutes_typical:
            lines.append(f"  Typical duration: {tmpl.duration_minutes_typical} min")
        if tmpl.exam_dominant_level:
            dist_str = ", ".join(
                f"{l}: {p}%" for l, p in tmpl.exam_level_distribution.items()
            )
            lines.append(f"  Exam difficulty: dominant={tmpl.exam_dominant_level} [{dist_str}]")
        for bp in tmpl.exercise_blueprints:
            pts = f", {bp.typical_points} pts" if bp.typical_points else ""
            lvl = f", level={bp.dominant_level}" if bp.dominant_level else ""
            lvl_dist = (
                " (" + ", ".join(f"{l}: {p}%" for l, p in bp.level_distribution.items()) + ")"
                if bp.level_distribution else ""
            )
            lines.append(
                f"  Exercise {bp.position}: {bp.type}, ~{bp.typical_q_count} questions{pts}{lvl}{lvl_dist}"
            )
        return "\n".join(lines)


# ── Singleton ─────────────────────────────────────────────────────────────────

_analyzer: TemplateAnalyzer | None = None


def get_analyzer(data_dir: str | Path | None = None) -> TemplateAnalyzer:
    global _analyzer
    if _analyzer is None:
        if data_dir is None:
            raise RuntimeError("TemplateAnalyzer not initialised — pass data_dir on first call")
        _analyzer = TemplateAnalyzer(data_dir)
    return _analyzer
