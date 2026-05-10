from sqlalchemy.orm import Session
from src.modules.teacher.model import Teacher
from src.modules.teacher.schema import TeacherRegisterRequest, TeacherUpdateRequest
from src.core.security import hash_password, verify_password


class TeacherService:
    @staticmethod
    def register(db: Session, data: TeacherRegisterRequest) -> Teacher:
        teacher = Teacher(
            first_name=data.first_name,
            last_name=data.last_name,
            email=data.email,
            password=hash_password(data.password),
        )
        db.add(teacher)
        db.commit()
        db.refresh(teacher)
        return teacher

    @staticmethod
    def update_profile(db: Session, teacher: Teacher, data: TeacherUpdateRequest) -> Teacher:
        for field in ('first_name', 'last_name', 'avatar', 'institution', 'department', 'position', 'phone', 'bio', 'theme'):
            value = getattr(data, field, None)
            if value is not None:
                setattr(teacher, field, value)
        db.commit()
        db.refresh(teacher)
        return teacher

    @staticmethod
    def change_password(db: Session, teacher: Teacher, current_password: str, new_password: str) -> bool:
        if not verify_password(current_password, teacher.password):
            return False
        teacher.password = hash_password(new_password)
        db.commit()
        return True

    @staticmethod
    def get_by_email(db: Session, email: str) -> Teacher | None:
        return db.query(Teacher).filter(Teacher.email == email).first()

    @staticmethod
    def authenticate(db: Session, email: str, password: str) -> Teacher | None:
        teacher = TeacherService.get_by_email(db, email)
        if not teacher or not verify_password(password, teacher.password):
            return None
        return teacher