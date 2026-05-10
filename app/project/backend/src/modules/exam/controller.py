import asyncio
import json
import httpx
from sqlalchemy.orm import Session
from fastapi import HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from src.core.config import settings
from src.modules.exam.schema import ExamCreate, ExamUpdate, ExamResponse, ExamPDFResponse
from src.modules.exam.service import ExamService
from src.modules.exam.model import ExamPDF
from src.modules.teacher.model import Teacher


class ExamController:
    def __init__(self):
        self.service = ExamService()

    def create(self, db: Session, teacher: Teacher, subject_id: int, data: ExamCreate) -> ExamResponse:
        exam = self.service.create(db, teacher, subject_id, data)
        return ExamResponse.model_validate(exam)

    def get_all(self, db: Session, teacher: Teacher, subject_id: int) -> list[ExamResponse]:
        exams = self.service.get_all(db, teacher, subject_id)
        return [ExamResponse.model_validate(e) for e in exams]

    def get_by_id(self, db: Session, teacher: Teacher, exam_id: int) -> ExamResponse:
        exam = self.service.get_by_id(db, teacher, exam_id)
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        return ExamResponse.model_validate(exam)

    def update(self, db: Session, teacher: Teacher, exam_id: int, data: ExamUpdate) -> ExamResponse:
        exam = self.service.get_by_id(db, teacher, exam_id)
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        updated = self.service.update(db, exam, data)
        return ExamResponse.model_validate(updated)

    def archive(self, db: Session, teacher: Teacher, exam_id: int) -> dict:
        exam = self.service.get_by_id(db, teacher, exam_id)
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        self.service.archive(db, exam)
        return {"message": "Exam archived"}

    def upload_pdf(self, db: Session, teacher: Teacher, exam_id: int, file: UploadFile) -> ExamPDFResponse:
        exam = self.service.get_by_id(db, teacher, exam_id)
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        pdf = self.service.add_pdf(db, exam, file)
        return ExamPDFResponse.model_validate(pdf)

    def delete_pdf(self, db: Session, teacher: Teacher, exam_id: int, pdf_id: int) -> dict:
        exam = self.service.get_by_id(db, teacher, exam_id)
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        pdf = db.query(ExamPDF).filter_by(id=pdf_id, exam_id=exam_id).first()
        if not pdf:
            raise HTTPException(status_code=404, detail="PDF not found")
        self.service.delete_pdf(db, pdf)
        return {"message": "PDF deleted"}

    async def generate(self, db: Session, teacher: Teacher, exam_id: int, params: dict, endpoint: str = "/api/generate") -> StreamingResponse:
        exam = self.service.get_by_id(db, teacher, exam_id)
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")

        # Pass teacher_id so exam-forge includes only this teacher's uploaded data
        params = {**params, "teacher_id": teacher.id}

        async def _proxy():
            queue: asyncio.Queue[bytes | None] = asyncio.Queue()

            async def _fetch() -> None:
                try:
                    async with httpx.AsyncClient(timeout=None) as client:
                        async with client.stream(
                            "POST",
                            f"{settings.AI_SERVICE_URL}{endpoint}",
                            json=params,
                        ) as resp:
                            if resp.status_code != 200:
                                body = await resp.aread()
                                await queue.put(f"event: error\ndata: {json.dumps({'message': body.decode()})}\n\n".encode())
                                return
                            async for chunk in resp.aiter_bytes():
                                await queue.put(chunk)
                except httpx.ConnectError:
                    await queue.put(f"event: error\ndata: {json.dumps({'message': 'AI service is not running'})}\n\n".encode())
                finally:
                    await queue.put(None)

            asyncio.create_task(_fetch())

            while True:
                try:
                    chunk = await asyncio.wait_for(queue.get(), timeout=20.0)
                    if chunk is None:
                        break
                    yield chunk
                except asyncio.TimeoutError:
                    # SSE comment — ignored by clients, keeps Cloudflare connection alive
                    yield b": keepalive\n\n"

        return StreamingResponse(
            _proxy(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
        )

        