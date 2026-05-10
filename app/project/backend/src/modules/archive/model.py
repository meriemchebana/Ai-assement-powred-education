from datetime import datetime, timezone
from sqlalchemy import String, Text, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from src.db.base import Base


class GeneratedArchive(Base):
    __tablename__ = "generated_archive"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"))
    ai_subject: Mapped[str] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(255), nullable=True)
    mode: Mapped[str] = mapped_column(String(20))   # "questions" | "full_exam"
    content: Mapped[str] = mapped_column(Text)       # JSON string
    # "pending" | "accepted" (draft) | "rejected" (trash)
    status: Mapped[str] = mapped_column(String(20), default='pending', server_default='pending')
    in_dataset: Mapped[bool] = mapped_column(Boolean, default=False, server_default='0')
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
