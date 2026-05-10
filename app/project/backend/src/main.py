from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
import os

from src.api import api_router
from src.core.config import settings
from src.db.base import Base
from src.db.database import engine

# Import all models so SQLAlchemy registers them before create_all
import src.modules.teacher.model       # noqa: F401
import src.modules.subject.model       # noqa: F401
import src.modules.exam.model          # noqa: F401
import src.modules.course.model        # noqa: F401
import src.modules.practical_series.model    # noqa: F401
import src.modules.theoretical_series.model  # noqa: F401
import src.modules.archive.model       # noqa: F401

# Create tables
Base.metadata.create_all(bind=engine)

# Migrate: add new columns if they don't exist (SQLite-safe)
def _migrate_columns():
    from sqlalchemy import text, inspect
    insp = inspect(engine)
    with engine.connect() as conn:
        teacher_cols = {c['name'] for c in insp.get_columns('teachers')}
        for col, typ in {
            'institution': 'VARCHAR(200)',
            'department':  'VARCHAR(200)',
            'position':    'VARCHAR(100)',
            'phone':       'VARCHAR(30)',
            'bio':         'TEXT',
            'theme':       'VARCHAR(10)',
        }.items():
            if col not in teacher_cols:
                conn.execute(text(f'ALTER TABLE teachers ADD COLUMN {col} {typ}'))

        for col, typ in {
            'exam_count':         'INTEGER DEFAULT 0',
            'exam_limit':         'INTEGER DEFAULT 10',
            'google_id':           'VARCHAR(255)',
            'is_verified':         'BOOLEAN DEFAULT 0',
            'verification_token':  'VARCHAR(255)',
            'reset_code':          'VARCHAR(10)',
            'reset_code_expires':  'REAL',
            'last_login':          'REAL',
        }.items():
            if col not in teacher_cols:
                conn.execute(text(f'ALTER TABLE teachers ADD COLUMN {col} {typ}'))

        archive_cols = {c['name'] for c in insp.get_columns('generated_archive')}
        for col, typ in {
            'status':     "VARCHAR(20) DEFAULT 'pending'",
            'in_dataset': 'BOOLEAN DEFAULT 0',
        }.items():
            if col not in archive_cols:
                conn.execute(text(f'ALTER TABLE generated_archive ADD COLUMN {col} {typ}'))

        subject_cols = {c['name'] for c in insp.get_columns('subjects')}
        for col, typ in {
            'cover_image': 'TEXT',
            'icon':        'VARCHAR(200)',
        }.items():
            if col not in subject_cols:
                conn.execute(text(f'ALTER TABLE subjects ADD COLUMN {col} {typ}'))

        conn.commit()

_migrate_columns()

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Allow Google OAuth popups to post messages back to the opener.
# Without this header Google's postMessage calls are blocked by the browser.
@app.middleware("http")
async def add_coop_header(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
    return response

# Serve uploaded PDFs
uploads_dir = settings.UPLOAD_DIR
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.APP_NAME}", "docs": "/docs"}

    