from pydantic import BaseModel, EmailStr


class TeacherRegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class TeacherUpdateRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    avatar: str | None = None
    institution: str | None = None
    department: str | None = None
    position: str | None = None
    phone: str | None = None
    bio: str | None = None
    theme: str | None = None


class TeacherResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    avatar: str | None = None
    institution: str | None = None
    department: str | None = None
    position: str | None = None
    phone: str | None = None
    bio: str | None = None
    theme: str | None = None
    exam_count: int = 0
    exam_limit: int = 10
    is_verified: bool = False
    is_admin: bool = False
    google_id: str | None = None

    class Config:
        from_attributes = True


class TeacherLoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    teacher: TeacherResponse
