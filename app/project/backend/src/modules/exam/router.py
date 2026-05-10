import asyncio
import os
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from src.db.database import get_db
from src.modules.auth.dependencies import get_current_teacher
from src.modules.teacher.model import Teacher
from src.modules.subject.model import Subject
from src.modules.exam.controller import ExamController
from src.modules.exam.schema import ExamCreate, ExamUpdate, ExamResponse, ExamPDFResponse
from src.modules.exam.model import ExamPDF
from src.services.docparser_service import parse_pdf_async, get_parse_status, auto_detect_subject
from src.core.config import settings


class GenerateRequest(BaseModel):
    subject: str
    count: int = 5
    question_type: str = "MCQ"
    level: str = "Mixed"
    topic: str | None = None
    questions_per_exercise: int = 3


class GenerateFullExamRequest(BaseModel):
    subject: str
    title: str | None = None
    n_exercises: int | None = None
    duration_minutes: int | None = None
    total_points: float | None = None
    target_level: str = "Mixed"
    pattern_override: str | None = None
    topic: str | None = None

router = APIRouter(prefix="/subjects/{subject_id}/exams", tags=["Exams"])
controller = ExamController()


@router.post("/", response_model=ExamResponse, status_code=201)
async def create_exam(subject_id: int, data: ExamCreate, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.create(db, teacher, subject_id, data)


@router.get("/", response_model=list[ExamResponse])
async def get_exams(subject_id: int, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.get_all(db, teacher, subject_id)


@router.get("/{exam_id}", response_model=ExamResponse)
async def get_exam(subject_id: int, exam_id: int, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.get_by_id(db, teacher, exam_id)


@router.put("/{exam_id}", response_model=ExamResponse)
async def update_exam(subject_id: int, exam_id: int, data: ExamUpdate, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.update(db, teacher, exam_id, data)


@router.delete("/{exam_id}")
async def archive_exam(subject_id: int, exam_id: int, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.archive(db, teacher, exam_id)


@router.post("/{exam_id}/pdfs", response_model=ExamPDFResponse)
async def upload_pdf(subject_id: int, exam_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    pdf = controller.upload_pdf(db, teacher, exam_id, file)
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    ai_subject = auto_detect_subject(subject.name if subject else "")
    pdf_path = pdf.filepath if os.path.isabs(pdf.filepath) else os.path.join(settings.UPLOAD_DIR, pdf.filepath)
    asyncio.create_task(parse_pdf_async(pdf.id, pdf_path, ai_subject, pdf.filename, teacher.id))
    return pdf


@router.delete("/{exam_id}/pdfs/{pdf_id}")
async def delete_pdf(subject_id: int, exam_id: int, pdf_id: int, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.delete_pdf(db, teacher, exam_id, pdf_id)


@router.post("/{exam_id}/generate")
async def generate_questions(subject_id: int, exam_id: int, req: GenerateRequest, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    params = req.model_dump()
    db_subject = db.query(Subject).filter(Subject.id == subject_id).first()
    school_subject_name = db_subject.name if db_subject else ""
    ai_subject = auto_detect_subject(school_subject_name)
    params["subject"] = ai_subject
    params["user_id"]  = f"teacher_{teacher.id}"
    if not params.get("topic"):
        params["topic"] = school_subject_name
    return await controller.generate(db, teacher, exam_id, params, endpoint="/api/generate")


@router.post("/{exam_id}/generate-full-exam")
async def generate_full_exam(subject_id: int, exam_id: int, req: GenerateFullExamRequest, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    params = req.model_dump(exclude_none=True)
    db_subject = db.query(Subject).filter(Subject.id == subject_id).first()
    school_subject_name = db_subject.name if db_subject else ""
    ai_subject = auto_detect_subject(school_subject_name)
    params["subject"] = ai_subject
    params["user_id"]  = f"teacher_{teacher.id}"
    if not params.get("topic"):
        params["topic"] = school_subject_name
    return await controller.generate(db, teacher, exam_id, params, endpoint="/api/generate-exam")


@router.post("/{exam_id}/pdfs/{pdf_id}/parse")
async def parse_pdf_for_ai(
    subject_id: int, exam_id: int, pdf_id: int,
    ai_subject: str = Query(..., description="exam-forge subject: algo|se|commerce|Law|compilation"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    exam = controller.service.get_by_id(db, teacher, exam_id)
    if not exam:
        raise HTTPException(404, "Exam not found")
    pdf = db.query(ExamPDF).filter_by(id=pdf_id, exam_id=exam_id).first()
    if not pdf:
        raise HTTPException(404, "PDF not found")

    import os
    from src.core.config import settings
    pdf_path = pdf.filepath if os.path.isabs(pdf.filepath) else os.path.join(settings.UPLOAD_DIR, pdf.filepath)

    asyncio.create_task(parse_pdf_async(pdf_id, pdf_path, ai_subject, pdf.filename, teacher.id))
    return {"message": "Parsing started", "pdf": pdf.filename, "pdf_id": pdf_id}


@router.get("/{exam_id}/pdfs/{pdf_id}/parse-status")
async def get_pdf_parse_status(subject_id: int, exam_id: int, pdf_id: int, teacher: Teacher = Depends(get_current_teacher)):
    return get_parse_status(pdf_id)