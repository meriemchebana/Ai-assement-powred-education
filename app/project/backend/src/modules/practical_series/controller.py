from sqlalchemy.orm import Session
from fastapi import HTTPException, UploadFile
from src.modules.practical_series.schema import PracticalSeriesCreate, PracticalSeriesUpdate, PracticalSeriesResponse, PracticalSeriesPDFResponse
from src.modules.practical_series.service import PracticalSeriesService
from src.modules.practical_series.model import PracticalSeriesPDF
from src.modules.teacher.model import Teacher


class PracticalSeriesController:
    def __init__(self): self.service = PracticalSeriesService()

    def create(self, db: Session, teacher: Teacher, subject_id: int, data: PracticalSeriesCreate) -> PracticalSeriesResponse:
        return PracticalSeriesResponse.model_validate(self.service.create(db, teacher, subject_id, data))

    def get_all(self, db: Session, teacher: Teacher, subject_id: int) -> list[PracticalSeriesResponse]:
        return [PracticalSeriesResponse.model_validate(ps) for ps in self.service.get_all(db, teacher, subject_id)]

    def get_by_id(self, db: Session, teacher: Teacher, ps_id: int) -> PracticalSeriesResponse:
        ps = self.service.get_by_id(db, teacher, ps_id)
        if not ps: raise HTTPException(404, "Practical series not found")
        return PracticalSeriesResponse.model_validate(ps)

    def update(self, db: Session, teacher: Teacher, ps_id: int, data: PracticalSeriesUpdate) -> PracticalSeriesResponse:
        ps = self.service.get_by_id(db, teacher, ps_id)
        if not ps: raise HTTPException(404, "Practical series not found")
        return PracticalSeriesResponse.model_validate(self.service.update(db, ps, data))

    def archive(self, db: Session, teacher: Teacher, ps_id: int) -> dict:
        ps = self.service.get_by_id(db, teacher, ps_id)
        if not ps: raise HTTPException(404, "Practical series not found")
        self.service.archive(db, ps)
        return {"message": "Practical series archived"}

    def upload_pdf(self, db: Session, teacher: Teacher, ps_id: int, file: UploadFile) -> PracticalSeriesPDFResponse:
        ps = self.service.get_by_id(db, teacher, ps_id)
        if not ps: raise HTTPException(404, "Practical series not found")
        return PracticalSeriesPDFResponse.model_validate(self.service.add_pdf(db, ps, file))

    def delete_pdf(self, db: Session, teacher: Teacher, ps_id: int, pdf_id: int) -> dict:
        ps = self.service.get_by_id(db, teacher, ps_id)
        if not ps: raise HTTPException(404, "Practical series not found")
        pdf = db.query(PracticalSeriesPDF).filter_by(id=pdf_id, practical_series_id=ps_id).first()
        if not pdf: raise HTTPException(404, "PDF not found")
        self.service.delete_pdf(db, pdf)
        return {"message": "PDF deleted"}

        