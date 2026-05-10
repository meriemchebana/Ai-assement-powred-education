from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from src.db.database import get_db
from src.modules.auth.dependencies import get_current_teacher
from src.modules.teacher.controller import TeacherController
from src.modules.teacher.model import Teacher
from src.modules.teacher.schema import TeacherRegisterRequest, TeacherUpdateRequest, TeacherResponse, ChangePasswordRequest

router = APIRouter(prefix="/teachers", tags=["Teachers"])
controller = TeacherController()


@router.post("/register", response_model=TeacherResponse)
async def register_teacher(
    data: TeacherRegisterRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    return await controller.register(db, data, background_tasks)


@router.get("/me", response_model=TeacherResponse)
async def get_me(teacher: Teacher = Depends(get_current_teacher)):
    return TeacherResponse.model_validate(teacher)


@router.patch("/me", response_model=TeacherResponse)
async def update_me(
    data: TeacherUpdateRequest,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    return controller.update_profile(db, teacher, data)


@router.patch("/me/password")
async def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    return controller.change_password(db, teacher, data)