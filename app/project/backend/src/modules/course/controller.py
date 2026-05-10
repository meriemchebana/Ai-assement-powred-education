from sqlalchemy.orm import Session
from fastapi import HTTPException, status, UploadFile
from src.modules.course.schema import CourseCreate, CourseUpdate, CourseResponse, CoursePDFResponse
from src.modules.course.service import CourseService
from src.modules.teacher.model import Teacher


class CourseController:
    def __init__(self):
        self.service = CourseService()

    def create(self, db: Session, teacher: Teacher, subject_id: int, data: CourseCreate) -> CourseResponse:
        course = self.service.create(db, teacher, subject_id, data)
        return CourseResponse.model_validate(course)

    def get_all(self, db: Session, teacher: Teacher, subject_id: int) -> list[CourseResponse]:
        courses = self.service.get_all(db, teacher, subject_id)
        return [CourseResponse.model_validate(c) for c in courses]

    def get_by_id(self, db: Session, teacher: Teacher, course_id: int) -> CourseResponse:
        course = self.service.get_by_id(db, teacher, course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        return CourseResponse.model_validate(course)

    def update(self, db: Session, teacher: Teacher, course_id: int, data: CourseUpdate) -> CourseResponse:
        course = self.service.get_by_id(db, teacher, course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        updated = self.service.update(db, course, data)
        return CourseResponse.model_validate(updated)

    def archive(self, db: Session, teacher: Teacher, course_id: int) -> dict:
        course = self.service.get_by_id(db, teacher, course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        self.service.archive(db, course)
        return {"message": "Course archived"}

    def upload_pdf(self, db: Session, teacher: Teacher, course_id: int, file: UploadFile) -> CoursePDFResponse:
        course = self.service.get_by_id(db, teacher, course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        pdf = self.service.add_pdf(db, course, file)
        return CoursePDFResponse.model_validate(pdf)

    # def delete_pdf(self, db: Session, teacher: Teacher, course_id: int, pdf_id: int) -> dict:
    #     course = self.service.get_by_id(db, teacher, course_id)
    #     if not course:
    #         raise HTTPException(status_code=404, detail="Course not found")
    #     pdf = db.query(self.service._get_pdf_model()).filter_by(id=pdf_id, course_id=course_id).first()
    #     if not pdf:
    #         raise HTTPException(status_code=404, detail="PDF not found")
    #     self.service.delete_pdf(db, pdf)
    #     return {"message": "PDF deleted"}

    def delete_pdf(self, db: Session, teacher: Teacher, course_id: int, pdf_id: int) -> dict:
        course = self.service.get_by_id(db, teacher, course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        
        # Import here to avoid circular imports
        from src.modules.course.model import CoursePDF
        pdf = db.query(CoursePDF).filter_by(id=pdf_id, course_id=course_id).first()
        
        if not pdf:
            raise HTTPException(status_code=404, detail="PDF not found")
        self.service.delete_pdf(db, pdf)
        return {"message": "PDF deleted"}
    
    def _get_pdf_model(self):
        from src.modules.course.model import CoursePDF
        return CoursePDF

        