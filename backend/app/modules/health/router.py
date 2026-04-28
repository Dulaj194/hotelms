import redis as redis_lib
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_db, get_redis, require_roles
from app.core.logging import get_logger
from app.modules.access import role_catalog
from app.modules.health.schemas import HealthResponse
from app.modules.health.service import get_health_status
from app.modules.users.model import User

logger = get_logger(__name__)

router = APIRouter()

_SUPER_ADMIN_OR_RESTAURANT_ADMIN_ROLES = role_catalog.SUPER_ADMIN_OR_RESTAURANT_ADMIN_ROLES


@router.get("/ready", response_model=dict)
def ready_check() -> dict:
    """
    Lightweight readiness check - no dependencies.
    Use this from nginx/load balancer for container health.
    """
    return {
        "status": "ready",
        "service": settings.app_name,
        "version": "1.0.0",
    }


@router.get("", response_model=HealthResponse)
def health_check(
    db: Session = Depends(get_db),
    redis_client: redis_lib.Redis = Depends(get_redis),
) -> HealthResponse:
    return get_health_status(db, redis_client)


@router.get("/diagnostic", response_model=dict)
def diagnostic_check(
    current_user: User = Depends(require_roles(*_SUPER_ADMIN_OR_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
    redis_client: redis_lib.Redis = Depends(get_redis),
) -> dict:
    """
    Admin diagnostic endpoint for troubleshooting.
    Returns detailed system info + user context + sample query results.
    """
    from app.modules.categories.repository import list_by_restaurant as list_categories
    from app.modules.menus.repository import list_by_restaurant as list_menus
    from app.modules.restaurants.repository import get_by_id as get_restaurant

    user_restaurant_id = current_user.restaurant_id or -1
    categories_total = 0
    if user_restaurant_id > 0:
        _, categories_total = list_categories(db, user_restaurant_id)

    return {
        "status": "ok",
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "role": current_user.role,
            "restaurant_id": user_restaurant_id,
        },
        "restaurant": {
            "id": user_restaurant_id,
            "name": get_restaurant(db, user_restaurant_id).name if user_restaurant_id > 0 else None,
        },
        "data_sample": {
            "menus_count": len(list_menus(db, user_restaurant_id)) if user_restaurant_id > 0 else 0,
            "categories_count": categories_total,
        },
        "backend": {
            "status": "ok",
            "database": "connected",
            "redis": "connected",
        },
    }
