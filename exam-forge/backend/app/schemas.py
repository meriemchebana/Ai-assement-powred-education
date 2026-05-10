from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

# #Schema_Types — shared Literal types used across generator, evaluator, and API
Level = Literal["Procedural", "Conceptual", "Metacognitive"]
LevelOrMixed = Literal["Procedural", "Conceptual", "Metacognitive", "Mixed"]
QuestionType = Literal["MCQ", "SAQ", "Exercise"]


# #Schema_StyleExample — one past question used as few-shot style anchor
class StyleExample(BaseModel):
    """A past question extracted from Meriem's labeled dataset, used as a few-shot style anchor."""
    subject: str
    level: Level | None = None
    module: str = ""
    language: str = ""
    stem: str
    solution: str = ""
    context: str = ""
    source: str = ""


# #Schema_MCQ — 4-choice question with validator enforcing exactly 4 distinct choices
class MCQ(BaseModel):
    """One multiple-choice question generated in the professor's style."""
    stem: str = Field(description="The question text, complete and self-contained.")
    choices: list[str] = Field(description="Exactly four answer choices, in the same language as the stem.")
    correct_index: int = Field(description="Zero-based index of the correct choice (0, 1, 2, or 3).", ge=0, le=3)
    explanation: str = Field(description="Short justification of why the correct choice is correct.")
    level: Level = Field(description="Cognitive level following the dataset taxonomy.")
    topic: str = Field(description="A short topic tag, e.g. 'binary search trees' or 'semaphores'.")

    @field_validator("choices")
    @classmethod
    def _exactly_four(cls, v: list[str]) -> list[str]:
        if len(v) != 4:
            raise ValueError(f"choices must have exactly 4 items, got {len(v)}")
        if len({c.strip() for c in v}) != 4:
            raise ValueError("choices must be distinct")
        if any(not c.strip() for c in v):
            raise ValueError("choices cannot be empty")
        return v


# #Schema_SAQ — short answer with model_answer + 2-6 bullet grading rubric
class SAQ(BaseModel):
    """One short-answer question generated in the professor's style."""
    stem: str = Field(description="The question text, complete and self-contained.")
    model_answer: str = Field(description="A concise ideal answer a strong student would give.")
    grading_rubric: list[str] = Field(
        description="Bullet points naming the key concepts or phrases a correct answer must contain, in the same language as the stem.",
    )
    level: Level = Field(description="Cognitive level following the dataset taxonomy.")
    topic: str = Field(description="A short topic tag, e.g. 'binary search trees' or 'semaphores'.")
    points: int = Field(ge=1, le=10, description="Suggested marks for this question (1-10).")

    @field_validator("grading_rubric")
    @classmethod
    def _rubric_shape(cls, v: list[str]) -> list[str]:
        if not (2 <= len(v) <= 6):
            raise ValueError(f"grading_rubric must have 2–6 bullets, got {len(v)}")
        if any(not b.strip() for b in v):
            raise ValueError("rubric bullets cannot be empty")
        return v


class ExerciseQuestion(BaseModel):
    """One sub-question within a multi-question exercise."""
    stem: str = Field(description="Sub-question text. May reference the exercise context or a previous sub-question's result.")
    model_answer: str = Field(description="Concise ideal answer a strong student would give.")
    grading_rubric: list[str] = Field(description="2-4 key points a correct answer must include.")
    points: int = Field(ge=1, le=8, description="Marks for this sub-question (1-8).")

    @field_validator("grading_rubric")
    @classmethod
    def _rubric_size(cls, v: list[str]) -> list[str]:
        if not (2 <= len(v) <= 4):
            raise ValueError(f"rubric must have 2-4 bullets, got {len(v)}")
        if any(not b.strip() for b in v):
            raise ValueError("rubric bullets cannot be empty")
        return v


# #Schema_Exercise — shared context + progressive sub-questions
class Exercise(BaseModel):
    """A structured exercise: shared context + related progressive sub-questions."""
    title: str = Field(description="Exercise title or scenario name.")
    context: str = Field(description="Self-contained problem setup — data, pseudocode, scenario, or definitions — that every sub-question builds on.")
    questions: list[ExerciseQuestion] = Field(description="Related sub-questions (exact count specified in the prompt) that build progressively on the context.")
    level: Level = Field(description="Overall cognitive level of the exercise.")
    topic: str = Field(description="Short topic tag.")
    reasoning: str | None = Field(None, description="Self-check trace: for each sub-question, state what data it needs, confirm it is present in the context, and flag any prior knowledge required (must be intuitive, not advanced).")

    @field_validator("questions")
    @classmethod
    def _q_count(cls, v: list[ExerciseQuestion]) -> list[ExerciseQuestion]:
        if len(v) < 2:
            raise ValueError(f"Exercise must have at least 2 sub-questions, got {len(v)}")
        return v


class ExerciseExample(BaseModel):
    """A past exercise extracted from the labeled dataset, used as a few-shot style anchor."""
    subject: str
    module: str = ""
    title: str = ""
    context: str = ""
    questions: list[dict] = []   # [{"stem": str, "solution": str}]
    source: str = ""


class GenerateRequest(BaseModel):
    subject: str
    level: LevelOrMixed = "Mixed"
    count: int = Field(ge=1, le=20, default=5)
    topic: str | None = None
    question_type: QuestionType = "MCQ"
    questions_per_exercise: int = Field(ge=2, le=5, default=3)
    teacher_id: int | None = None
    user_id: str | None = None   # Supabase user UUID for cloud RAG
    critique: str | None = None  # Evaluator feedback to guide regeneration


class ExamSectionConfig(BaseModel):
    section_title: str | None = None
    subject: str
    type: QuestionType = "MCQ"
    count: int = Field(ge=1, le=20, default=3)
    points_per_question: float = Field(gt=0, default=1.0)
    topic: str | None = None
    level: LevelOrMixed = "Mixed"
    questions_per_exercise: int = Field(ge=2, le=5, default=3)


class GenerateExamRequest(BaseModel):
    exam_title: str | None = None
    sections: list[ExamSectionConfig] = Field(min_length=1, max_length=8)
    duration_minutes: int | None = None
    teacher_id: int | None = None
    user_id: str | None = None   # Supabase user UUID for cloud RAG


# #Schema_EvalResult — 4-axis verdict: factual_ok + level_correct + quality + difficulty calibration
class EvaluationResult(BaseModel):
    """Structured verdict from gpt-oss-120b on a generated question, grounded in RAG course material."""
    # Axis 1 — content grounded in course material?
    factual_ok: bool = Field(description="True if question and answer are consistent with the course material.")
    # Axis 2 — Bloom's level label correct?
    level_correct: bool = Field(description="True if the assigned cognitive level matches the question's actual difficulty.")
    corrected_level: Literal["Factual", "Procedural", "Conceptual", "Metacognitive"] | None = Field(
        default=None,
        description="The correct level if level_correct is False, otherwise null."
    )
    # Axis 3 — question well-formed?
    quality: Literal["good", "needs_revision", "reject"] = Field(
        description="good = clear and usable; needs_revision = minor issues; reject = fundamentally flawed."
    )
    # Axis 4 — difficulty vs points vs time calibration
    points_calibration: Literal["too_low", "fair", "too_high"] = Field(
        description="Whether the allocated points match the cognitive effort and time required."
    )
    difficulty_ok: bool = Field(
        description="True if the difficulty is appropriate for the target student level (not trivial, not unreasonably hard)."
    )
    estimated_minutes: int = Field(
        description="Estimated minutes a competent student needs to answer this question fully."
    )
    # Overall verdict
    verdict: Literal["pass", "flag", "reject"] = Field(
        description="pass = ready to use; flag = review recommended; reject = discard."
    )
    notes: str = Field(description="One or two sentences explaining the verdict, including calibration feedback.")


class SubjectSummary(BaseModel):
    subject: str
    total: int
    levels: dict[str, int]


class SubjectsResponse(BaseModel):
    subjects: list[SubjectSummary]
    model: str
