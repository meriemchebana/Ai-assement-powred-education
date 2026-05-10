from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from src.db.database import get_db
from src.modules.auth.controller import AuthController
from src.modules.auth.schema import LoginRequest, TokenResponse, GoogleAuthRequest, VerifyEmailRequest, ForgotPasswordRequest, VerifyResetCodeRequest, ResetPasswordRequest

router = APIRouter(prefix="/auth", tags=["Auth"])
controller = AuthController()


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: Session = Depends(get_db)):
    return controller.login(db, data)


@router.post("/google", response_model=TokenResponse)
async def google_login(data: GoogleAuthRequest, db: Session = Depends(get_db)):
    return await controller.google_login(db, data)


@router.post("/verify-email")
async def verify_email(data: VerifyEmailRequest, db: Session = Depends(get_db)):
    return await controller.verify_email(db, data)


@router.post("/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    from src.modules.auth.service import AuthService
    from src.core.email_sender import send_reset_code_email
    code = AuthService.generate_reset_code(db, data.email)
    if code:
        background_tasks.add_task(send_reset_code_email, data.email, code)
    # Always return OK to not leak which emails exist
    return {"message": "إذا كان الإيميل مسجلاً، ستصلك رسالة بالكود"}


@router.post("/verify-reset-code")
async def verify_reset_code(data: VerifyResetCodeRequest, db: Session = Depends(get_db)):
    from src.modules.auth.service import AuthService
    ok = AuthService.verify_reset_code(db, data.email, data.code)
    if not ok:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    return {"message": "Code verified"}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    from src.modules.auth.service import AuthService
    ok = AuthService.reset_password(db, data.email, data.code, data.new_password)
    if not ok:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="الكود غير صحيح أو منتهي الصلاحية")
    return {"message": "تم إعادة تعيين كلمة المرور بنجاح"}


@router.post("/resend-verification")
async def resend_verification(
    email: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    return await controller.resend_verification(db, email, background_tasks)
