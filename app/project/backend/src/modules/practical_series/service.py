from sqlalchemy.orm import Session, joinedload
from fastapi import UploadFile
from src.modules.practical_series.model import PracticalSeries, PracticalSeriesPDF
from src.modules.practical_series.schema import PracticalSeriesCreate, PracticalSeriesUpdate
from src.modules.teacher.model import Teacher
from src.core.file_handler import save_pdf, delete_pdf_file


class PracticalSeriesService:
    @staticmethod
    def create(db: Session, teacher: Teacher, subject_id: int, data: PracticalSeriesCreate) -> PracticalSeries:
        ps = PracticalSeries(title=data.title, description=data.description, subject_id=subject_id, teacher_id=teacher.id)
        db.add(ps)
        db.commit()
        db.refresh(ps)
        return ps

    @staticmethod
    def get_all(db: Session, teacher: Teacher, subject_id: int) -> list[PracticalSeries]:
        return db.query(PracticalSeries).options(joinedload(PracticalSeries.pdfs)).filter(
            PracticalSeries.subject_id == subject_id,
            PracticalSeries.teacher_id == teacher.id,
            PracticalSeries.is_archived == False,
        ).all()

    @staticmethod
    def get_by_id(db: Session, teacher: Teacher, ps_id: int) -> PracticalSeries | None:
        return db.query(PracticalSeries).options(joinedload(PracticalSeries.pdfs)).filter(
            PracticalSeries.id == ps_id, PracticalSeries.teacher_id == teacher.id
        ).first()

    @staticmethod
    def update(db: Session, ps: PracticalSeries, data: PracticalSeriesUpdate) -> PracticalSeries:
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(ps, key, value)
        db.commit()
        db.refresh(ps)
        return ps

    @staticmethod
    def archive(db: Session, ps: PracticalSeries):
        ps.is_archived = True
        db.commit()

    @staticmethod
    def add_pdf(db: Session, ps: PracticalSeries, file: UploadFile) -> PracticalSeriesPDF:
        filepath = save_pdf(file, f"practical_series/{ps.id}")
        pdf = PracticalSeriesPDF(filename=file.filename, filepath=filepath, practical_series_id=ps.id)
        db.add(pdf)
        db.commit()
        db.refresh(pdf)
        return pdf

    @staticmethod
    def delete_pdf(db: Session, pdf: PracticalSeriesPDF):
        delete_pdf_file(pdf.filepath)
        db.delete(pdf)
        db.commit()

        