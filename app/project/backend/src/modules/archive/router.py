import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.db.database import get_db
from src.modules.auth.dependencies import get_current_teacher
from src.modules.teacher.model import Teacher
from src.modules.archive.service import ArchiveService
from src.modules.archive.schema import ArchiveCreate, ArchiveUpdate, ArchiveResponse

router = APIRouter(prefix="/archive", tags=["Archive"])
service = ArchiveService()


def _to_response(entry) -> ArchiveResponse:
    return ArchiveResponse(
        id=entry.id,
        ai_subject=entry.ai_subject,
        title=entry.title,
        mode=entry.mode,
        content=json.loads(entry.content),
        status=entry.status or 'pending',
        in_dataset=bool(entry.in_dataset),
        created_at=entry.created_at,
    )


@router.get("/", response_model=list[ArchiveResponse])
async def list_archive(
    subject: str | None = Query(None),
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    entries = service.get_all(db, teacher, subject)
    return [_to_response(e) for e in entries]


@router.post("/", response_model=ArchiveResponse, status_code=201)
async def save_to_archive(
    data: ArchiveCreate,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    entry = service.create(db, teacher, data)
    return _to_response(entry)


@router.patch("/{entry_id}", response_model=ArchiveResponse)
async def update_archive_entry(
    entry_id: int,
    data: ArchiveUpdate,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    entry = service.update(db, teacher, entry_id, data.status, data.in_dataset)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return _to_response(entry)


@router.delete("/{entry_id}")
async def delete_archive_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    ok = service.delete(db, teacher, entry_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Deleted"}
