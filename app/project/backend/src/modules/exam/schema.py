from pydantic import BaseModel


class ExamPDFResponse(BaseModel):
    id: int
    filename: str
    filepath: str  # Add this

    class Config:
        from_attributes = True

class ExamCreate(BaseModel):
    title: str
    description: str | None = None


class ExamUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class ExamResponse(BaseModel):
    id: int
    title: str
    description: str | None
    is_archived: bool
    subject_id: int
    teacher_id: int
    pdfs: list[ExamPDFResponse] = []

    class Config:
        from_attributes = True
        