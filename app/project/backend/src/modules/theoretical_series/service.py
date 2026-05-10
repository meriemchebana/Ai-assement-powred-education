from sqlalchemy.orm import Session, joinedload
from fastapi import UploadFile
from src.modules.theoretical_series.model import TheoreticalSeries, TheoreticalSeriesPDF
from src.modules.theoretical_series.schema import TheoreticalSeriesCreate, TheoreticalSeriesUpdate
from src.modules.teacher.model import Teacher
from src.core.file_handler import save_pdf, delete_pdf_file


class TheoreticalSeriesService:
    @staticmethod
    def create(db: Session, teacher: Teacher, subject_id: int, data: TheoreticalSeriesCreate) -> TheoreticalSeries:
        ts = TheoreticalSeries(
            title=data.title,
            description=data.description,
            subject_id=subject_id,
            teacher_id=teacher.id,
        )
        db.add(ts)
        db.commit()
        db.refresh(ts)
        return ts

    @staticmethod
    def get_all(db: Session, teacher: Teacher, subject_id: int) -> list[TheoreticalSeries]:
        return (
            db.query(TheoreticalSeries)
            .options(joinedload(TheoreticalSeries.pdfs))
            .filter(
                TheoreticalSeries.subject_id == subject_id,
                TheoreticalSeries.teacher_id == teacher.id,
                TheoreticalSeries.is_archived == False,
            )
            .all()
        )

    @staticmethod
    def get_by_id(db: Session, teacher: Teacher, ts_id: int) -> TheoreticalSeries | None:
        return (
            db.query(TheoreticalSeries)
            .options(joinedload(TheoreticalSeries.pdfs))
            .filter(TheoreticalSeries.id == ts_id, TheoreticalSeries.teacher_id == teacher.id)
            .first()
        )

    @staticmethod
    def update(db: Session, ts: TheoreticalSeries, data: TheoreticalSeriesUpdate) -> TheoreticalSeries:
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(ts, key, value)
        db.commit()
        db.refresh(ts)
        return ts

    @staticmethod
    def archive(db: Session, ts: TheoreticalSeries):
        ts.is_archived = True
        db.commit()

    @staticmethod
    def add_pdf(db: Session, ts: TheoreticalSeries, file: UploadFile) -> TheoreticalSeriesPDF:
        filepath = save_pdf(file, f"theoretical_series/{ts.id}")
        pdf = TheoreticalSeriesPDF(filename=file.filename, filepath=filepath, theoretical_series_id=ts.id)
        db.add(pdf)
        db.commit()
        db.refresh(pdf)
        return pdf

    @staticmethod
    def delete_pdf(db: Session, pdf: TheoreticalSeriesPDF):
        delete_pdf_file(pdf.filepath)
        db.delete(pdf)
        db.commit()

        