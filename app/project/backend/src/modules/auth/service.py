import uuid
import time
import random
from sqlalchemy.orm import Session
from src.modules.teacher.service import TeacherService
from src.modules.teacher.model import Teacher
from src.core.security import create_access_token, hash_password
from src.core.config import settings


class AuthService:
    @staticmethod
    def login(db: Session, email: str, password: str) -> dict | None:
        import time
        teacher = TeacherService.authenticate(db, email, password)
        if not teacher:
            return None
        is_first_login = teacher.last_login is None
        teacher.last_login = time.time()
        db.commit()
        token = create_access_token({"sub": str(teacher.id), "email": teacher.email})
        return {"access_token": token, "teacher": teacher, "is_first_login": is_first_login}

    @staticmethod
    def google_auth(db: Session, credential: str) -> dict | None:
        from google.oauth2 import id_token
        from google.auth.transport import requests as g_requests

        if not settings.GOOGLE_CLIENT_ID:
            raise ValueError("GOOGLE_CLIENT_ID not configured")

        try:
            info = id_token.verify_oauth2_token(
                credential,
                g_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )
        except Exception:
            return None

        google_id = info.get("sub")
        email     = info.get("email", "")
        first_name = info.get("given_name", "")
        last_name  = info.get("family_name", "")
        avatar     = info.get("picture")

        # Find by google_id first, then by email
        teacher = db.query(Teacher).filter(Teacher.google_id == google_id).first()
        if not teacher:
            teacher = db.query(Teacher).filter(Teacher.email == email).first()
            if teacher:
                teacher.google_id  = google_id
                teacher.is_verified = True
                if avatar and not teacher.avatar:
                    teacher.avatar = avatar
            else:
                teacher = Teacher(
                    first_name=first_name or "User",
                    last_name=last_name or "",
                    email=email,
                    password=hash_password(uuid.uuid4().hex),
                    google_id=google_id,
                    is_verified=True,
                    avatar=avatar,
                )
                db.add(teacher)
            db.commit()
            db.refresh(teacher)

        token = create_access_token({"sub": str(teacher.id), "email": teacher.email})
        return {"access_token": token, "teacher": teacher}

    @staticmethod
    def send_verification(db: Session, teacher: Teacher) -> str:
        token = uuid.uuid4().hex
        teacher.verification_token = token
        db.commit()
        return token

    @staticmethod
    def generate_reset_code(db: Session, email: str) -> str | None:
        from src.modules.teacher.service import TeacherService
        teacher = TeacherService.get_by_email(db, email)
        if not teacher:
            return None
        code = str(random.randint(100000, 999999))
        teacher.reset_code         = code
        teacher.reset_code_expires = time.time() + 15 * 60  # 15 minutes
        db.commit()
        return code

    @staticmethod
    def verify_reset_code(db: Session, email: str, code: str) -> bool:
        from src.modules.teacher.service import TeacherService
        teacher = TeacherService.get_by_email(db, email)
        if not teacher:
            return False
        if teacher.reset_code != code:
            return False
        if not teacher.reset_code_expires or time.time() > teacher.reset_code_expires:
            return False
        return True

    @staticmethod
    def reset_password(db: Session, email: str, code: str, new_password: str) -> bool:
        from src.modules.teacher.service import TeacherService
        from src.core.security import hash_password
        teacher = TeacherService.get_by_email(db, email)
        if not teacher:
            return False
        if teacher.reset_code != code:
            return False
        if not teacher.reset_code_expires or time.time() > teacher.reset_code_expires:
            return False
        teacher.password           = hash_password(new_password)
        teacher.reset_code         = None
        teacher.reset_code_expires = None
        db.commit()
        return True

    @staticmethod
    def verify_email(db: Session, token: str) -> Teacher | None:
        teacher = db.query(Teacher).filter(Teacher.verification_token == token).first()
        if not teacher:
            return None
        teacher.is_verified       = True
        teacher.verification_token = None
        db.commit()
        db.refresh(teacher)
        return teacher
