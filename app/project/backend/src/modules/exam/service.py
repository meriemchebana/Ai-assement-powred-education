from sqlalchemy.orm import Session, joinedload
from fastapi import UploadFile
from src.modules.exam.model import Exam, ExamPDF
from src.modules.exam.schema import ExamCreate, ExamUpdate
from src.modules.teacher.model import Teacher
from src.core.file_handler import save_pdf, delete_pdf_file


class ExamService:
    @staticmethod
    def create(db: Session, teacher: Teacher, subject_id: int, data: ExamCreate) -> Exam:
        exam = Exam(
            title=data.title,
            description=data.description,
            subject_id=subject_id,
            teacher_id=teacher.id,
        )
        db.add(exam)
        db.commit()
        db.refresh(exam)
        return exam

    @staticmethod
    def get_all(db: Session, teacher: Teacher, subject_id: int) -> list[Exam]:
        return (
            db.query(Exam)
            .options(joinedload(Exam.pdfs))
            .filter(
                Exam.subject_id == subject_id,
                Exam.teacher_id == teacher.id,
                Exam.is_archived == False,
            )
            .all()
        )

    @staticmethod
    def get_by_id(db: Session, teacher: Teacher, exam_id: int) -> Exam | None:
        return (
            db.query(Exam)
            .options(joinedload(Exam.pdfs))
            .filter(Exam.id == exam_id, Exam.teacher_id == teacher.id)
            .first()
        )

    @staticmethod
    def update(db: Session, exam: Exam, data: ExamUpdate) -> Exam:
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(exam, key, value)
        db.commit()
        db.refresh(exam)
        return exam

    @staticmethod
    def archive(db: Session, exam: Exam):
        exam.is_archived = True
        db.commit()

    @staticmethod
    def add_pdf(db: Session, exam: Exam, file: UploadFile) -> ExamPDF:
        filepath = save_pdf(file, f"exams/{exam.id}")
        pdf = ExamPDF(filename=file.filename, filepath=filepath, exam_id=exam.id)
        db.add(pdf)
        db.commit()
        db.refresh(pdf)
        return pdf

    @staticmethod
    def delete_pdf(db: Session, pdf: ExamPDF):
        delete_pdf_file(pdf.filepath)
        db.delete(pdf)
        db.commit()

        