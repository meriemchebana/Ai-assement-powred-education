import asyncio
import os
from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from src.db.database import get_db
from src.modules.auth.dependencies import get_current_teacher
from src.modules.teacher.model import Teacher
from src.modules.subject.model import Subject
from src.modules.practical_series.controller import PracticalSeriesController
from src.modules.practical_series.schema import PracticalSeriesCreate, PracticalSeriesUpdate, PracticalSeriesResponse, PracticalSeriesPDFResponse
from src.services.docparser_service import parse_pdf_async, auto_detect_subject
from src.core.config import settings

router = APIRouter(prefix="/subjects/{subject_id}/practical-series", tags=["Practical Series"])
controller = PracticalSeriesController()

@router.post("/", response_model=PracticalSeriesResponse, status_code=201)
async def create(subject_id: int, data: PracticalSeriesCreate, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.create(db, teacher, subject_id, data)

@router.get("/", response_model=list[PracticalSeriesResponse])
async def get_all(subject_id: int, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.get_all(db, teacher, subject_id)

@router.get("/{ps_id}", response_model=PracticalSeriesResponse)
async def get_one(subject_id: int, ps_id: int, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.get_by_id(db, teacher, ps_id)

@router.put("/{ps_id}", response_model=PracticalSeriesResponse)
async def update(subject_id: int, ps_id: int, data: PracticalSeriesUpdate, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.update(db, teacher, ps_id, data)

@router.delete("/{ps_id}")
async def archive(subject_id: int, ps_id: int, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.archive(db, teacher, ps_id)

@router.post("/{ps_id}/pdfs", response_model=PracticalSeriesPDFResponse)
async def upload_pdf(subject_id: int, ps_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    pdf = controller.upload_pdf(db, teacher, ps_id, file)
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    ai_subject = auto_detect_subject(subject.name if subject else "")
    pdf_path = pdf.filepath if os.path.isabs(pdf.filepath) else os.path.join(settings.UPLOAD_DIR, pdf.filepath)
    asyncio.create_task(parse_pdf_async(pdf.id, pdf_path, ai_subject, pdf.filename))
    return pdf

@router.delete("/{ps_id}/pdfs/{pdf_id}")
async def delete_pdf(subject_id: int, ps_id: int, pdf_id: int, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.delete_pdf(db, teacher, ps_id, pdf_id)


@router.post("/{exam_id}/generate")
async def generate_exam(subject_id: int, exam_id: int, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    # TODO: Implement AI exam generation
    return {"message": "Exam generation endpoint — not implemented yet"}