from sqlalchemy import String, Text, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.db.base import Base


class TheoreticalSeries(Base):
    __tablename__ = "theoretical_series"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"))

    pdfs: Mapped[list["TheoreticalSeriesPDF"]] = relationship("TheoreticalSeriesPDF", back_populates="theoretical_series", cascade="all, delete-orphan")


class TheoreticalSeriesPDF(Base):
    __tablename__ = "theoretical_series_pdfs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(255))
    filepath: Mapped[str] = mapped_column(String(500))
    theoretical_series_id: Mapped[int] = mapped_column(ForeignKey("theoretical_series.id", ondelete="CASCADE"))

    theoretical_series: Mapped["TheoreticalSeries"] = relationship("TheoreticalSeries", back_populates="pdfs")

    