import asyncio
import os
from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from src.db.database import get_db
from src.modules.auth.dependencies import get_current_teacher
from src.modules.teacher.model import Teacher
from src.modules.subject.model import Subject
from src.modules.course.controller import CourseController
from src.modules.course.schema import CourseCreate, CourseUpdate, CourseResponse, CoursePDFResponse
from src.services.docparser_service import parse_pdf_async, auto_detect_subject
from src.core.config import settings

router = APIRouter(prefix="/subjects/{subject_id}/courses", tags=["Courses"])
controller = CourseController()


@router.post("/", response_model=CourseResponse, status_code=201)
async def create_course(subject_id: int, data: CourseCreate, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.create(db, teacher, subject_id, data)


@router.get("/", response_model=list[CourseResponse])
async def get_courses(subject_id: int, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.get_all(db, teacher, subject_id)


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(subject_id: int, course_id: int, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.get_by_id(db, teacher, course_id)


@router.put("/{course_id}", response_model=CourseResponse)
async def update_course(subject_id: int, course_id: int, data: CourseUpdate, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.update(db, teacher, course_id, data)


@router.delete("/{course_id}")
async def archive_course(subject_id: int, course_id: int, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.archive(db, teacher, course_id)


@router.post("/{course_id}/pdfs", response_model=CoursePDFResponse)
async def upload_pdf(subject_id: int, course_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    pdf = controller.upload_pdf(db, teacher, course_id, file)
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    ai_subject = auto_detect_subject(subject.name if subject else "")
    pdf_path = pdf.filepath if os.path.isabs(pdf.filepath) else os.path.join(settings.UPLOAD_DIR, pdf.filepath)
    asyncio.create_task(parse_pdf_async(pdf.id, pdf_path, ai_subject, pdf.filename, teacher.id))
    return pdf


@router.delete("/{course_id}/pdfs/{pdf_id}")
async def delete_pdf(subject_id: int, course_id: int, pdf_id: int, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    return controller.delete_pdf(db, teacher, course_id, pdf_id)

    