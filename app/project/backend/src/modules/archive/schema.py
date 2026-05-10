from datetime import datetime
from pydantic import BaseModel
from typing import Any


class ArchiveCreate(BaseModel):
    ai_subject: str
    title: str | None = None
    mode: str                # "questions" | "full_exam"
    content: Any             # list[question] or AssembledExam dict
    status: str = 'pending'  # "pending" | "accepted" | "rejected"


class ArchiveUpdate(BaseModel):
    status: str | None = None       # "pending" | "accepted" | "rejected"
    in_dataset: bool | None = None


class ArchiveResponse(BaseModel):
    id: int
    ai_subject: str
    title: str | None
    mode: str
    content: Any
    status: str = 'pending'
    in_dataset: bool = False
    created_at: datetime

    class Config:
        from_attributes = True
