from datetime import datetime
from pydantic import BaseModel


class SubjectCreate(BaseModel):
    name: str
    description: str | None = None


class SubjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    cover_image: str | None = None
    icon: str | None = None


class SubjectResponse(BaseModel):
    id: int
    name: str
    description: str | None
    cover_image: str | None = None
    icon: str | None = None
    teacher_id: int

    class Config:
        from_attributes = True