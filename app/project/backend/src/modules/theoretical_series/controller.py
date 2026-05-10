from sqlalchemy.orm import Session
from fastapi import HTTPException, UploadFile
from src.modules.theoretical_series.schema import TheoreticalSeriesCreate, TheoreticalSeriesUpdate, TheoreticalSeriesResponse, TheoreticalSeriesPDFResponse
from src.modules.theoretical_series.service import TheoreticalSeriesService
from src.modules.theoretical_series.model import TheoreticalSeriesPDF
from src.modules.teacher.model import Teacher


class TheoreticalSeriesController:
    def __init__(self):
        self.service = TheoreticalSeriesService()

    def create(self, db: Session, teacher: Teacher, subject_id: int, data: TheoreticalSeriesCreate) -> TheoreticalSeriesResponse:
        ts = self.service.create(db, teacher, subject_id, data)
        return TheoreticalSeriesResponse.model_validate(ts)

    def get_all(self, db: Session, teacher: Teacher, subject_id: int) -> list[TheoreticalSeriesResponse]:
        items = self.service.get_all(db, teacher, subject_id)
        return [TheoreticalSeriesResponse.model_validate(item) for item in items]

    def get_by_id(self, db: Session, teacher: Teacher, ts_id: int) -> TheoreticalSeriesResponse:
        ts = self.service.get_by_id(db, teacher, ts_id)
        if not ts:
            raise HTTPException(status_code=404, detail="Theoretical series not found")
        return TheoreticalSeriesResponse.model_validate(ts)

    def update(self, db: Session, teacher: Teacher, ts_id: int, data: TheoreticalSeriesUpdate) -> TheoreticalSeriesResponse:
        ts = self.service.get_by_id(db, teacher, ts_id)
        if not ts:
            raise HTTPException(status_code=404, detail="Theoretical series not found")
        updated = self.service.update(db, ts, data)
        return TheoreticalSeriesResponse.model_validate(updated)

    def archive(self, db: Session, teacher: Teacher, ts_id: int) -> dict:
        ts = self.service.get_by_id(db, teacher, ts_id)
        if not ts:
            raise HTTPException(status_code=404, detail="Theoretical series not found")
        self.service.archive(db, ts)
        return {"message": "Theoretical series archived"}

    def upload_pdf(self, db: Session, teacher: Teacher, ts_id: int, file: UploadFile) -> TheoreticalSeriesPDFResponse:
        ts = self.service.get_by_id(db, teacher, ts_id)
        if not ts:
            raise HTTPException(status_code=404, detail="Theoretical series not found")
        pdf = self.service.add_pdf(db, ts, file)
        return TheoreticalSeriesPDFResponse.model_validate(pdf)

    def delete_pdf(self, db: Session, teacher: Teacher, ts_id: int, pdf_id: int) -> dict:
        ts = self.service.get_by_id(db, teacher, ts_id)
        if not ts:
            raise HTTPException(status_code=404, detail="Theoretical series not found")
        pdf = db.query(TheoreticalSeriesPDF).filter_by(id=pdf_id, theoretical_series_id=ts_id).first()
        if not pdf:
            raise HTTPException(status_code=404, detail="PDF not found")
        self.service.delete_pdf(db, pdf)
        return {"message": "PDF deleted"}

        