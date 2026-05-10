from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    message: str


class PingResponse(BaseModel):
    ping: str