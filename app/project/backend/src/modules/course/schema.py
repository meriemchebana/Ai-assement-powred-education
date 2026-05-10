from pydantic import BaseModel


class CoursePDFResponse(BaseModel):
    id: int
    filename: str
    filepath: str  # Add this

    class Config:
        from_attributes = True

class CourseCreate(BaseModel):
    title: str
    description: str | None = None


class CourseUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class CourseResponse(BaseModel):
    id: int
    title: str
    description: str | None
    is_archived: bool
    subject_id: int
    teacher_id: int
    pdfs: list[CoursePDFResponse] = []

    class Config:
        from_attributes = True