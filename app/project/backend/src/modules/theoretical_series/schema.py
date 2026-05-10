from pydantic import BaseModel


class TheoreticalSeriesPDFResponse(BaseModel):
    id: int
    filename: str
    filepath: str 

    class Config:
        from_attributes = True


class TheoreticalSeriesCreate(BaseModel):
    title: str
    description: str | None = None


class TheoreticalSeriesUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class TheoreticalSeriesResponse(BaseModel):
    id: int
    title: str
    description: str | None
    is_archived: bool
    subject_id: int
    teacher_id: int
    pdfs: list[TheoreticalSeriesPDFResponse] = []

    class Config:
        from_attributes = True

        