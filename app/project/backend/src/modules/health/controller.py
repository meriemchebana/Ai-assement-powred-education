from src.modules.health.schema import HealthResponse, PingResponse
from src.modules.health.service import HealthService


class HealthController:
    def __init__(self):
        self.service = HealthService()

    def health_check(self) -> HealthResponse:
        data = self.service.get_health()
        return HealthResponse(**data)

    def ping(self) -> PingResponse:
        data = self.service.ping()
        return PingResponse(**data)