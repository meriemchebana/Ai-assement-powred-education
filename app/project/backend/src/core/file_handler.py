import os
import uuid
import shutil
from fastapi import UploadFile
from src.core.config import settings

ALLOWED_EXTENSIONS = {".pdf"}

def save_pdf(file: UploadFile, subfolder: str) -> str:
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("Only PDF files are allowed")

    folder = os.path.join(settings.UPLOAD_DIR, subfolder)
    os.makedirs(folder, exist_ok=True)

    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(folder, filename)

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return filepath

def delete_pdf_file(filepath: str):
    if os.path.exists(filepath):
        os.remove(filepath)

