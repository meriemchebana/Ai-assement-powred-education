from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    APP_NAME: str = "Boxing Management API"
    DEBUG: bool = True
    DATABASE_URL: str = "sqlite:///./generator_school.db"
    SECRET_KEY: str = "change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 525600  # 1 year
    ALGORITHM: str = "HS256"
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
    AI_SERVICE_URL: str = "http://127.0.0.1:28000"

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""

    # Email (Gmail SMTP)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        env_file = ".env"


settings = Settings()

