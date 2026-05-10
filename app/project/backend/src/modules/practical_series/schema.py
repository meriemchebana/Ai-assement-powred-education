from pydantic import BaseModel


class PracticalSeriesPDFResponse(BaseModel):
    id: int
    filename: str
    filepath: str
    
    class Config: 
        from_attributes = True


class PracticalSeriesCreate(BaseModel):
    title: str
    description: str | None = None


class PracticalSeriesUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class PracticalSeriesResponse(BaseModel):
    id: int
    title: str
    description: str | None
    is_archived: bool
    subject_id: int
    teacher_id: int
    pdfs: list[PracticalSeriesPDFResponse] = []
    class Config: from_attributes = True

    