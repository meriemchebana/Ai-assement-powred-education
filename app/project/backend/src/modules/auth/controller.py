from sqlalchemy.orm import Session
from src.modules.auth.schema import LoginRequest, TokenResponse, GoogleAuthRequest, VerifyEmailRequest
from src.modules.auth.service import AuthService
from src.modules.teacher.schema import TeacherResponse
from fastapi import HTTPException, status, BackgroundTasks


class AuthController:
    def __init__(self):
        self.service = AuthService()

    def login(self, db: Session, data: LoginRequest) -> TokenResponse:
        result = self.service.login(db, data.email, data.password)
        if not result:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
        return TokenResponse(
            access_token=result["access_token"],
            teacher=TeacherResponse.model_validate(result["teacher"]),
        )

    async def google_login(self, db: Session, data: GoogleAuthRequest) -> TokenResponse:
        try:
            result = self.service.google_auth(db, data.credential)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
        if not result:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google credential")
        return TokenResponse(
            access_token=result["access_token"],
            teacher=TeacherResponse.model_validate(result["teacher"]),
        )

    async def verify_email(self, db: Session, data: VerifyEmailRequest) -> dict:
        teacher = self.service.verify_email(db, data.token)
        if not teacher:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")
        return {"message": "Email verified successfully"}

    async def resend_verification(self, db: Session, email: str, background_tasks: BackgroundTasks) -> dict:
        from src.modules.teacher.service import TeacherService
        from src.core.email_sender import send_verification_email
        teacher = TeacherService.get_by_email(db, email)
        if not teacher or teacher.is_verified:
            return {"message": "ok"}
        token = self.service.send_verification(db, teacher)
        background_tasks.add_task(send_verification_email, teacher.email, token)
        return {"message": "Verification email sent"}
