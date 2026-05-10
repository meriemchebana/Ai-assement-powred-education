from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.db.database import get_db
from src.modules.auth.dependencies import get_current_teacher
from src.modules.teacher.model import Teacher
from src.modules.subject.controller import SubjectController
from src.modules.subject.schema import SubjectCreate, SubjectUpdate, SubjectResponse

router = APIRouter(prefix="/subjects", tags=["Subjects"])
controller = SubjectController()


@router.post("/", response_model=SubjectResponse, status_code=201)
async def create_subject(
    data: SubjectCreate,
    db: Session = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_teacher),
):
    return controller.create(db, current_teacher, data)


@router.get("/", response_model=list[SubjectResponse])
async def get_subjects(
    db: Session = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_teacher),
):
    return controller.get_all(db, current_teacher)


@router.get("/{subject_id}", response_model=SubjectResponse)
async def get_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_teacher),
):
    return controller.get_by_id(db, current_teacher, subject_id)


@router.put("/{subject_id}", response_model=SubjectResponse)
async def update_subject(
    subject_id: int,
    data: SubjectUpdate,
    db: Session = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_teacher),
):
    return controller.update(db, current_teacher, subject_id, data)


@router.delete("/{subject_id}")
async def delete_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_teacher),
):
    return controller.delete(db, current_teacher, subject_id)