"""Load labeled exam JSONs and expose filter-based style-example sampling.

No embeddings: the dataset is already hand-labeled with subject + level, so a plain
filter+sample gives stronger style control than semantic retrieval for generation.

Handles the three schemas documented in the original json_chunker:
  A - top-level {"exercises": [...]} with nested Question lists and subquestions.
  B - flat list of QA dicts at root.
  C - dict mapping keys -> QA dicts.
"""

from __future__ import annotations

import json
import random
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable

from .schemas import ExerciseExample, Level, StyleExample

QUESTION_KEYS = {"question_text", "question", "q", "سؤال", "text", "prompt"}
ANSWER_KEYS = {"Solution", "solution", "answer", "a", "إجابة", "حل", "verdict", "response"}
CONTEXT_KEYS = {"introduction_context", "pseudocode", "semaphore_init_table", "note"}
LEVEL_VALUES: set[str] = {"Procedural", "Conceptual", "Metacognitive"}


def _pick(obj: dict, candidates: set[str]) -> str:
    for key in candidates:
        val = obj.get(key)
        if val in (None, "", []):
            continue
        if isinstance(val, (dict, list)):
            return json.dumps(val, ensure_ascii=False, indent=2)
        s = str(val).strip()
        if s:
            return s
    return ""


def _detect_schema(data: Any) -> str:
    if isinstance(data, dict) and "exercises" in data:
        return "A"
    if isinstance(data, list) and data and isinstance(data[0], dict):
        return "B"
    if isinstance(data, dict):
        vals = list(data.values())
        if vals and isinstance(vals[0], dict):
            return "C"
    return "unknown"


def _norm_level(raw: Any) -> Level | None:
    if not raw:
        return None
    s = str(raw).strip().capitalize()
    if s in LEVEL_VALUES:
        return s  # type: ignore[return-value]
    return None


def _iter_schema_a(data: dict, subject: str, source: str) -> Iterable[StyleExample]:
    meta = data.get("metadata", {}) or {}
    module = str(meta.get("module", ""))
    language = str(meta.get("language", ""))

    for exercise in data.get("exercises", []) or []:
        if not isinstance(exercise, dict):
            continue
        ex_ctx = _pick(exercise, CONTEXT_KEYS)

        raw_q = exercise.get("Question", [])
        if isinstance(raw_q, dict):
            raw_q = [raw_q]
        if not isinstance(raw_q, list):
            continue

        for q in raw_q:
            if not isinstance(q, dict):
                continue
            q_ctx = _pick(q, CONTEXT_KEYS) or ex_ctx
            subs = q.get("subquestions", [])
            if isinstance(subs, list) and subs:
                for sq in subs:
                    if not isinstance(sq, dict):
                        continue
                    stem = _pick(sq, QUESTION_KEYS) or _pick(q, QUESTION_KEYS)
                    if not stem:
                        continue
                    yield StyleExample(
                        subject=subject,
                        level=_norm_level(sq.get("level") or q.get("level")),
                        module=module,
                        language=language,
                        stem=stem,
                        solution=_pick(sq, ANSWER_KEYS),
                        context=_pick(sq, CONTEXT_KEYS) or q_ctx,
                        source=source,
                    )
            else:
                stem = _pick(q, QUESTION_KEYS)
                if not stem:
                    continue
                yield StyleExample(
                    subject=subject,
                    level=_norm_level(q.get("level")),
                    module=module,
                    language=language,
                    stem=stem,
                    solution=_pick(q, ANSWER_KEYS),
                    context=q_ctx,
                    source=source,
                )


def _iter_schema_b(data: list, subject: str, source: str) -> Iterable[StyleExample]:
    for item in data:
        if not isinstance(item, dict):
            continue
        stem = _pick(item, QUESTION_KEYS)
        if not stem:
            continue
        yield StyleExample(
            subject=subject,
            level=_norm_level(item.get("level")),
            stem=stem,
            solution=_pick(item, ANSWER_KEYS),
            context=_pick(item, CONTEXT_KEYS),
            source=source,
        )


def _iter_schema_c(data: dict, subject: str, source: str) -> Iterable[StyleExample]:
    for _, item in data.items():
        if not isinstance(item, dict):
            continue
        stem = _pick(item, QUESTION_KEYS)
        if not stem:
            continue
        yield StyleExample(
            subject=subject,
            level=_norm_level(item.get("level")),
            stem=stem,
            solution=_pick(item, ANSWER_KEYS),
            context=_pick(item, CONTEXT_KEYS),
            source=source,
        )


def _load_exercises_schema_a(data: dict, subject: str, source: str) -> list[ExerciseExample]:
    """Extract exercise-level examples (only Schema A has the exercise grouping)."""
    meta = data.get("metadata", {}) or {}
    module = str(meta.get("module", ""))
    exercises: list[ExerciseExample] = []

    for ex in data.get("exercises", []) or []:
        if not isinstance(ex, dict):
            continue
        title = str(ex.get("title") or ex.get("exercise_title") or ex.get("id") or "")
        context = _pick(ex, CONTEXT_KEYS)

        raw_q = ex.get("Question", [])
        if isinstance(raw_q, dict):
            raw_q = [raw_q]
        if not isinstance(raw_q, list):
            continue

        qs: list[dict] = []
        for q in raw_q:
            if not isinstance(q, dict):
                continue
            stem = _pick(q, QUESTION_KEYS)
            sol = _pick(q, ANSWER_KEYS)
            if not stem:
                continue
            subs = q.get("subquestions", [])
            if isinstance(subs, list) and subs:
                for sq in subs:
                    if not isinstance(sq, dict):
                        continue
                    sub_stem = _pick(sq, QUESTION_KEYS)
                    if sub_stem:
                        qs.append({"stem": f"{stem} – {sub_stem}" if stem else sub_stem,
                                   "solution": _pick(sq, ANSWER_KEYS)})
            else:
                qs.append({"stem": stem, "solution": sol})

        if len(qs) >= 2:
            exercises.append(ExerciseExample(
                subject=subject,
                module=module,
                title=title,
                context=context,
                questions=qs,
                source=source,
            ))
    return exercises


def _load_one(path: Path, subject: str) -> list[StyleExample]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    schema = _detect_schema(data)
    if schema == "A":
        return list(_iter_schema_a(data, subject, path.name))
    if schema == "B":
        return list(_iter_schema_b(data, subject, path.name))
    if schema == "C":
        return list(_iter_schema_c(data, subject, path.name))
    return []


class Dataset:
    def __init__(self, root: Path, teacher_id: int | None = None, include_shared: bool = False) -> None:
        self.root = Path(root)
        self.teacher_id = teacher_id
        self.include_shared = include_shared
        self.examples: list[StyleExample] = []
        self._by_subject_level: dict[tuple[str, str | None], list[int]] = defaultdict(list)
        self._by_subject: dict[str, list[int]] = defaultdict(list)
        self.exercise_examples: list[ExerciseExample] = []
        self._exercises_by_subject: dict[str, list[int]] = defaultdict(list)
        self._load()

    def _allowed(self, path: Path) -> bool:
        """Each teacher sees only their own files (teacher_{id}/ folder).
        teacher_id=None means admin/system access — sees everything.
        include_shared=True also allows files outside any teacher_ folder (shared datasets).
        """
        if self.teacher_id is None:
            return True
        for part in path.parts:
            if part.startswith("teacher_"):
                return part == f"teacher_{self.teacher_id}"
        # File is not inside any teacher_ folder → shared dataset
        return self.include_shared

    def _load(self) -> None:
        if not self.root.exists():
            raise FileNotFoundError(
                f"Dataset directory not found: {self.root}. "
                "Copy final_unified/ into backend/data/ (see README)."
            )
        for subject_dir in sorted(p for p in self.root.iterdir() if p.is_dir()):
            subject = subject_dir.name
            for json_path in subject_dir.rglob("*.json"):
                if not self._allowed(json_path):
                    continue
                for ex in _load_one(json_path, subject):
                    idx = len(self.examples)
                    self.examples.append(ex)
                    self._by_subject[subject].append(idx)
                    self._by_subject_level[(subject, ex.level)].append(idx)
                # also load exercise-level examples (Schema A only)
                try:
                    data = json.loads(json_path.read_text(encoding="utf-8"))
                except Exception:
                    continue
                if isinstance(data, dict) and "exercises" in data:
                    for ex_ex in _load_exercises_schema_a(data, subject, json_path.name):
                        eidx = len(self.exercise_examples)
                        self.exercise_examples.append(ex_ex)
                        self._exercises_by_subject[subject].append(eidx)

    def subjects(self) -> list[str]:
        return sorted(self._by_subject.keys())

    def summary(self) -> list[dict]:
        out: list[dict] = []
        for subject in self.subjects():
            levels: dict[str, int] = defaultdict(int)
            for idx in self._by_subject[subject]:
                key = self.examples[idx].level or "Unlabeled"
                levels[key] += 1
            out.append({
                "subject": subject,
                "total": len(self._by_subject[subject]),
                "levels": dict(levels),
            })
        return out

    def sample_exercises(self, subject: str, n: int, rng: random.Random | None = None) -> list[ExerciseExample]:
        rng = rng or random.Random()
        pool = list(self._exercises_by_subject.get(subject, []))
        if not pool:
            return []
        rng.shuffle(pool)
        return [self.exercise_examples[i] for i in pool[:n]]

    def sample_exercises_by_topic(
        self, subject: str, topic: str | None, n: int, rng: random.Random | None = None
    ) -> list[ExerciseExample]:
        rng = rng or random.Random()
        pool = list(self._exercises_by_subject.get(subject, []))
        if not pool:
            return []
        if topic:
            kw = topic.lower()
            topic_pool = [i for i in pool
                          if kw in self.exercise_examples[i].title.lower()
                          or kw in self.exercise_examples[i].module.lower()
                          or kw in self.exercise_examples[i].context.lower()]
            if topic_pool:
                pool = topic_pool
        rng.shuffle(pool)
        return [self.exercise_examples[i] for i in pool[:n]]

    def sample(self, subject: str, level: str | None, n: int, rng: random.Random | None = None) -> list[StyleExample]:
        rng = rng or random.Random()
        pool: list[int]
        if level and level != "Mixed":
            pool = list(self._by_subject_level.get((subject, level), []))
            if len(pool) < n:
                # Fall back to any level for the same subject so we always return context.
                extras = [i for i in self._by_subject.get(subject, []) if i not in pool]
                rng.shuffle(extras)
                pool.extend(extras[: max(0, n - len(pool))])
        else:
            pool = list(self._by_subject.get(subject, []))
        if not pool:
            return []
        rng.shuffle(pool)
        return [self.examples[i] for i in pool[:n]]

    def sample_by_topic(
        self, subject: str, level: str | None, topic: str | None, n: int, rng: random.Random | None = None
    ) -> list[StyleExample]:
        """Like sample() but narrows to topic keyword in module field when possible."""
        rng = rng or random.Random()
        if level and level != "Mixed":
            pool = list(self._by_subject_level.get((subject, level), []))
            if len(pool) < n:
                extras = [i for i in self._by_subject.get(subject, []) if i not in pool]
                rng.shuffle(extras)
                pool.extend(extras[: max(0, n - len(pool))])
        else:
            pool = list(self._by_subject.get(subject, []))
        if topic and pool:
            kw = topic.lower()
            topic_pool = [i for i in pool if kw in self.examples[i].module.lower() or kw in self.examples[i].stem.lower()]
            if topic_pool:
                pool = topic_pool
        if not pool:
            return []
        rng.shuffle(pool)
        return [self.examples[i] for i in pool[:n]]
