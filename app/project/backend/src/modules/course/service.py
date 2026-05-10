from sqlalchemy.orm import Session, joinedload
from fastapi import UploadFile
from src.modules.course.model import Course, CoursePDF
from src.modules.course.schema import CourseCreate, CourseUpdate
from src.modules.teacher.model import Teacher
from src.core.file_handler import save_pdf, delete_pdf_file


class CourseService:
    @staticmethod
    def create(db: Session, teacher: Teacher, subject_id: int, data: CourseCreate) -> Course:
        course = Course(
            title=data.title,
            description=data.description,
            subject_id=subject_id,
            teacher_id=teacher.id,
        )
        db.add(course)
        db.commit()
        db.refresh(course)
        return course

    @staticmethod
    def get_all(db: Session, teacher: Teacher, subject_id: int) -> list[Course]:
        return (
            db.query(Course)
            .options(joinedload(Course.pdfs))
            .filter(
                Course.subject_id == subject_id,
                Course.teacher_id == teacher.id,
                Course.is_archived == False,
            )
            .all()
        )

    @staticmethod
    def get_by_id(db: Session, teacher: Teacher, course_id: int) -> Course | None:
        return (
            db.query(Course)
            .options(joinedload(Course.pdfs))
            .filter(Course.id == course_id, Course.teacher_id == teacher.id)
            .first()
        )

    @staticmethod
    def update(db: Session, course: Course, data: CourseUpdate) -> Course:
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(course, key, value)
        db.commit()
        db.refresh(course)
        return course

    @staticmethod
    def archive(db: Session, course: Course):
        course.is_archived = True
        db.commit()

    @staticmethod
    def add_pdf(db: Session, course: Course, file: UploadFile) -> CoursePDF:
        filepath = save_pdf(file, f"courses/{course.id}")
        pdf = CoursePDF(filename=file.filename, filepath=filepath, course_id=course.id)
        db.add(pdf)
        db.commit()
        db.refresh(pdf)
        return pdf

    @staticmethod
    def get_pdfs(db: Session, course: Course) -> list[CoursePDF]:
        return db.query(CoursePDF).filter(CoursePDF.course_id == course.id).all()

    @staticmethod
    def delete_pdf(db: Session, pdf: CoursePDF):
        delete_pdf_file(pdf.filepath)
        db.delete(pdf)
        db.commit()

        