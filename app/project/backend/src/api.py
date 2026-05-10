from fastapi import APIRouter
from src.modules.health.router import router as health_router
from src.modules.teacher.router import router as teacher_router
from src.modules.auth.router import router as auth_router
from src.modules.subject.router import router as subject_router
from src.modules.course.router import router as course_router
from src.modules.practical_series.router import router as practical_series_router
from src.modules.theoretical_series.router import router as theoretical_series_router
from src.modules.exam.router import router as exam_router
from src.modules.archive.router import router as archive_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(teacher_router)
api_router.include_router(auth_router)
api_router.include_router(subject_router)
api_router.include_router(course_router)
api_router.include_router(practical_series_router)
api_router.include_router(theoretical_series_router)
api_router.include_router(exam_router)
api_router.include_router(archive_router)

