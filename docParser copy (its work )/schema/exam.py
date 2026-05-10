"""Pydantic schema — article's IDP model adapted for bilingual Algerian exams."""
from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator


class TableData(BaseModel):
    id: str                          # "table_1", "table_2", …
    caption: Optional[str] = None
    headers: list[str] = Field(default_factory=list)
    rows: list[list[Any]] = Field(default_factory=list)
    table_type: Optional[str] = None  # "reference" | "data" | None

    @field_validator("rows", mode="before")
    @classmethod
    def coerce_cells_to_str(cls, rows: Any) -> Any:
        if not isinstance(rows, list):
            return rows
        return [[str(cell) if not isinstance(cell, str) else cell for cell in row]
                for row in rows if isinstance(row, list)]


class DiagramData(BaseModel):
    id: str                    # "diag_p3_1"
    name: str                  # descriptive name
    image_path: str            # path to saved PNG
    page: int
    bbox: list[float]          # [x0, y0, x1, y1] on page
    question_id: Optional[str] # nearest question, or None
    description: str           # VLM detailed description
    model_used: str            # "qwen2.5-vl-72b" | "gemini-2.0-flash"


class Solution(BaseModel):
    text: Optional[str] = None             # réponse textuelle / explication
    tables: list[TableData] = Field(default_factory=list)   # tableaux dans la solution
    code: list[str] = Field(default_factory=list)           # blocs de code / expressions
    diagram: Optional[str] = None          # description textuelle d'un schéma/automate


VALID_LEVELS = {"Factual", "Conceptual", "Procedural", "Metacognitive"}


class Question(BaseModel):
    id: str
    type: str = Field(pattern="^(QCM|FREE|CODE)$")
    question_text: str
    intro_context: Optional[str] = None
    choices: list[str] = Field(default_factory=list)
    solution: Optional[Solution] = None
    reference_table_id: Optional[str] = None
    points: Optional[float] = None
    level: Optional[str] = None   # Bloom's level: Factual|Conceptual|Procedural|Metacognitive
    diagrams: list[DiagramData] = Field(default_factory=list)
    sub_questions: list["Question"] = Field(default_factory=list)


class Exercise(BaseModel):
    id: str
    title: str
    total_points: Optional[float] = None
    intro_context: Optional[str] = None
    questions: list[Question] = Field(default_factory=list)
    tables: list[TableData] = Field(default_factory=list)
    code_blocks: list[str] = Field(default_factory=list)
    diagrams: list[DiagramData] = Field(default_factory=list)


class ExamMetadata(BaseModel):
    title: str
    subject: str
    academic_level: str = ""
    year: str = ""
    language: str = "french"          # "french" | "arabic" | "bilingual"
    duration: str = ""
    institution: str = ""


class Exam(BaseModel):
    metadata: ExamMetadata
    exercises: list[Exercise] = Field(default_factory=list)
    global_tables: list[TableData] = Field(default_factory=list)  # reference sheets
    global_code: list[str] = Field(default_factory=list)          # code annexes at document level
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    needs_review: bool = False
    source_pdf: str = ""
