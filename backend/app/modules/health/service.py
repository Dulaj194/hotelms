import redis as redis_lib
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.health.repository import check_database, check_redis
from app.modules.health.schemas import HealthResponse


def get_health_status(db: Session, redis_client: redis_lib.Redis) -> HealthResponse:
    """Aggregate connectivity checks and return a unified health response."""
    db_status = check_database(db)
    redis_status = check_redis(redis_client)

    return HealthResponse(
        status="ok",
        service=settings.app_name,
        database=db_status,
        redis=redis_status,
        environment=settings.app_env,
    )
