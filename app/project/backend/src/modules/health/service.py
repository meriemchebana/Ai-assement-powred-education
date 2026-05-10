class HealthService:
    @staticmethod
    def get_health() -> dict:
        return {"status": "healthy", "message": "API is running"}

    @staticmethod
    def ping() -> dict:
        return {"ping": "pong! 🥊"}