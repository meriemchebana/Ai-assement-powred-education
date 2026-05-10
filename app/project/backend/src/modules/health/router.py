from fastapi import APIRouter

from src.modules.health.controller import HealthController
from src.modules.health.schema import HealthResponse, PingResponse

router = APIRouter(prefix="/health", tags=["Health"])
controller = HealthController()


@router.get("/", response_model=HealthResponse)
async def health_check():
    return controller.health_check()


@router.get("/ping", response_model=PingResponse)
async def ping():
    return controller.ping()