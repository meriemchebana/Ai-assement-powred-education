from sqlalchemy import String, Text, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.db.base import Base


class PracticalSeries(Base):
    __tablename__ = "practical_series"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"))

    pdfs: Mapped[list["PracticalSeriesPDF"]] = relationship("PracticalSeriesPDF", back_populates="practical_series", cascade="all, delete-orphan")


class PracticalSeriesPDF(Base):
    __tablename__ = "practical_series_pdfs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(255))
    filepath: Mapped[str] = mapped_column(String(500))
    practical_series_id: Mapped[int] = mapped_column(ForeignKey("practical_series.id", ondelete="CASCADE"))

    practical_series: Mapped["PracticalSeries"] = relationship("PracticalSeries", back_populates="pdfs")

    