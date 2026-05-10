import json
from fastapi import HTTPException
from sqlalchemy.orm import Session
from src.modules.archive.model import GeneratedArchive
from src.modules.archive.schema import ArchiveCreate
from src.modules.teacher.model import Teacher

FREE_LIMIT = 10


class ArchiveService:
    @staticmethod
    def create(db: Session, teacher: Teacher, data: ArchiveCreate) -> GeneratedArchive:
        is_admin = getattr(teacher, 'is_admin', False)
        if not is_admin:
            limit = teacher.exam_limit if teacher.exam_limit is not None else FREE_LIMIT
            count = teacher.exam_count if teacher.exam_count is not None else 0
            if count >= limit:
                raise HTTPException(
                    status_code=402,
                    detail=f"Free plan limit reached ({limit} generations). Upgrade to continue.",
                )

        entry = GeneratedArchive(
            teacher_id=teacher.id,
            ai_subject=data.ai_subject,
            title=data.title,
            mode=data.mode,
            content=json.dumps(data.content, ensure_ascii=False),
            status=data.status,
        )
        db.add(entry)

        if not is_admin:
            teacher.exam_count = (teacher.exam_count or 0) + 1
        db.commit()
        db.refresh(entry)
        return entry

    @staticmethod
    def get_all(db: Session, teacher: Teacher, subject: str | None = None) -> list[GeneratedArchive]:
        q = db.query(GeneratedArchive).filter(GeneratedArchive.teacher_id == teacher.id)
        if subject:
            q = q.filter(GeneratedArchive.ai_subject == subject)
        return q.order_by(GeneratedArchive.created_at.desc()).all()

    @staticmethod
    def update(db: Session, teacher: Teacher, entry_id: int, status: str | None, in_dataset: bool | None) -> GeneratedArchive | None:
        entry = db.query(GeneratedArchive).filter_by(id=entry_id, teacher_id=teacher.id).first()
        if not entry:
            return None
        if status is not None:
            entry.status = status
        if in_dataset is not None:
            entry.in_dataset = in_dataset
        db.commit()
        db.refresh(entry)
        return entry

    @staticmethod
    def delete(db: Session, teacher: Teacher, entry_id: int) -> bool:
        entry = db.query(GeneratedArchive).filter_by(id=entry_id, teacher_id=teacher.id).first()
        if not entry:
            return False
        db.delete(entry)
        db.commit()
        return True
