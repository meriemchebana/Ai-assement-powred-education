import asyncio
import os
from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from src.db.database import get_db
from src.modules.auth.dependencies import get_current_teacher
from src.modules.teacher.model import Teacher
from src.modules.subject.model import Subject
from src.modules.theoretical_series.controller import TheoreticalSeriesController
from src.modules.theoretical_series.schema import TheoreticalSeriesCreate, TheoreticalSeriesUpdate, TheoreticalSeriesResponse, TheoreticalSeriesPDFResponse
from src.services.docparser_service import parse_pdf_async, auto_detect_subject
from src.core.config import settings

router = APIRouter(prefix="/subjects/{subject_id}/theoretical-series", tags=["Theoretical Series"])
controller = TheoreticalSeriesController()


@router.post("/", response_model=TheoreticalSeriesResponse, status_code=201)
async def create_theoretical_series(subject_id: int, data: TheoreticalSeriesCreate, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.create(db, teacher, subject_id, data)


@router.get("/", response_model=list[TheoreticalSeriesResponse])
async def get_theoretical_series(subject_id: int, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.get_all(db, teacher, subject_id)


@router.get("/{ts_id}", response_model=TheoreticalSeriesResponse)
async def get_theoretical_series_by_id(subject_id: int, ts_id: int, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.get_by_id(db, teacher, ts_id)


@router.put("/{ts_id}", response_model=TheoreticalSeriesResponse)
async def update_theoretical_series(subject_id: int, ts_id: int, data: TheoreticalSeriesUpdate, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.update(db, teacher, ts_id, data)


@router.delete("/{ts_id}")
async def archive_theoretical_series(subject_id: int, ts_id: int, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.archive(db, teacher, ts_id)


@router.post("/{ts_id}/pdfs", response_model=TheoreticalSeriesPDFResponse)
async def upload_pdf(subject_id: int, ts_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    pdf = controller.upload_pdf(db, teacher, ts_id, file)
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    ai_subject = auto_detect_subject(subject.name if subject else "")
    pdf_path = pdf.filepath if os.path.isabs(pdf.filepath) else os.path.join(settings.UPLOAD_DIR, pdf.filepath)
    asyncio.create_task(parse_pdf_async(pdf.id, pdf_path, ai_subject, pdf.filename))
    return pdf


@router.delete("/{ts_id}/pdfs/{pdf_id}")
async def delete_pdf(subject_id: int, ts_id: int, pdf_id: int, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.delete_pdf(db, teacher, ts_id, pdf_id)

    