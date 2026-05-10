from sqlalchemy import String, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.db.base import Base


class Teacher(Base):
    __tablename__ = "teachers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password: Mapped[str] = mapped_column(String(255))
    avatar: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Teacher professional info
    institution: Mapped[str | None] = mapped_column(String(200), nullable=True)
    department: Mapped[str | None] = mapped_column(String(200), nullable=True)
    position: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    theme: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Auth extras
    google_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    is_verified: Mapped[bool] = mapped_column(default=False, server_default="0")
    verification_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reset_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    reset_code_expires: Mapped[float | None] = mapped_column(nullable=True)

    # Freemium quota
    exam_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    exam_limit: Mapped[int] = mapped_column(Integer, default=10, server_default="10")

    # Admin flag — bypasses all quota checks
    is_admin: Mapped[bool] = mapped_column(default=False, server_default="0")

    # Tracks first login
    last_login: Mapped[float | None] = mapped_column(nullable=True)

    subjects: Mapped[list["Subject"]] = relationship("Subject", backref="teacher", lazy="selectin")