import redis as redis_lib
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_redis
from app.modules.health.schemas import HealthResponse
from app.modules.health.service import get_health_status

router = APIRouter()


@router.get("", response_model=HealthResponse)
def health_check(
    db: Session = Depends(get_db),
    redis_client: redis_lib.Redis = Depends(get_redis),
) -> HealthResponse:
    return get_health_status(db, redis_client)
