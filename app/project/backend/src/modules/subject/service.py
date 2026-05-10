from sqlalchemy.orm import Session
from src.modules.subject.model import Subject
from src.modules.subject.schema import SubjectCreate, SubjectUpdate
from src.modules.teacher.model import Teacher


class SubjectService:
    @staticmethod
    def create(db: Session, teacher: Teacher, data: SubjectCreate) -> Subject:
        subject = Subject(
            name=data.name,
            description=data.description,
            teacher_id=teacher.id,
        )
        db.add(subject)
        db.commit()
        db.refresh(subject)
        return subject

    @staticmethod
    def get_all_by_teacher(db: Session, teacher: Teacher) -> list[Subject]:
        return db.query(Subject).filter(Subject.teacher_id == teacher.id).all()

    @staticmethod
    def get_by_id(db: Session, teacher: Teacher, subject_id: int) -> Subject | None:
        return (
            db.query(Subject)
            .filter(Subject.id == subject_id, Subject.teacher_id == teacher.id)
            .first()
        )

    @staticmethod
    def update(db: Session, subject: Subject, data: SubjectUpdate) -> Subject:
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(subject, key, value)
        db.commit()
        db.refresh(subject)
        return subject

    @staticmethod
    def delete(db: Session, subject: Subject) -> None:
        db.delete(subject)
        db.commit()