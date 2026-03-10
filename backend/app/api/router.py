from fastapi import APIRouter

from app.core.config import settings
from app.modules.health.router import router as health_router

router = APIRouter(prefix=settings.api_v1_prefix)

router.include_router(health_router, prefix="/health", tags=["health"])
