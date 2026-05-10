from sqlalchemy.orm import Session
from src.modules.teacher.schema import (
    TeacherRegisterRequest,
    TeacherUpdateRequest,
    TeacherResponse,
    TeacherLoginRequest,
    TokenResponse,
)
from src.modules.teacher.service import TeacherService
from src.modules.teacher.model import Teacher
from src.core.security import create_access_token


class TeacherController:
    def __init__(self):
        self.service = TeacherService()

    async def register(self, db: Session, data: TeacherRegisterRequest, background_tasks) -> TeacherResponse:
        from fastapi import HTTPException
        from src.modules.auth.service import AuthService
        from src.core.email_sender import send_verification_email
        existing = self.service.get_by_email(db, data.email)
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        teacher = self.service.register(db, data)
        token = AuthService.send_verification(db, teacher)
        background_tasks.add_task(send_verification_email, teacher.email, token)
        return TeacherResponse.model_validate(teacher)

    def change_password(self, db: Session, teacher: Teacher, data) -> dict:
        from fastapi import HTTPException
        ok = self.service.change_password(db, teacher, data.current_password, data.new_password)
        if not ok:
            raise HTTPException(status_code=400, detail="كلمة المرور الحالية غير صحيحة")
        return {"message": "تم تغيير كلمة المرور بنجاح"}

    def update_profile(self, db: Session, teacher: Teacher, data: TeacherUpdateRequest) -> TeacherResponse:
        updated = self.service.update_profile(db, teacher, data)
        return TeacherResponse.model_validate(updated)

    def login(self, db: Session, data: TeacherLoginRequest) -> TokenResponse | None:
        teacher = self.service.authenticate(db, data.email, data.password)
        if not teacher:
            return None
        token = create_access_token({"sub": str(teacher.id), "email": teacher.email})
        return TokenResponse(
            access_token=token,
            teacher=TeacherResponse.model_validate(teacher),
        )