from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from src.modules.subject.schema import SubjectCreate, SubjectUpdate, SubjectResponse
from src.modules.subject.service import SubjectService
from src.modules.teacher.model import Teacher


class SubjectController:
    def __init__(self):
        self.service = SubjectService()

    def create(self, db: Session, teacher: Teacher, data: SubjectCreate) -> SubjectResponse:
        subject = self.service.create(db, teacher, data)
        return SubjectResponse.model_validate(subject)

    def get_all(self, db: Session, teacher: Teacher) -> list[SubjectResponse]:
        subjects = self.service.get_all_by_teacher(db, teacher)
        return [SubjectResponse.model_validate(s) for s in subjects]

    def get_by_id(self, db: Session, teacher: Teacher, subject_id: int) -> SubjectResponse:
        subject = self.service.get_by_id(db, teacher, subject_id)
        if not subject:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
        return SubjectResponse.model_validate(subject)

    def update(self, db: Session, teacher: Teacher, subject_id: int, data: SubjectUpdate) -> SubjectResponse:
        subject = self.service.get_by_id(db, teacher, subject_id)
        if not subject:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
        updated = self.service.update(db, subject, data)
        return SubjectResponse.model_validate(updated)

    def delete(self, db: Session, teacher: Teacher, subject_id: int) -> dict:
        subject = self.service.get_by_id(db, teacher, subject_id)
        if not subject:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
        self.service.delete(db, subject)
        return {"message": "Subject deleted successfully"}