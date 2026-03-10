from fastapi import APIRouter

from app.core.config import settings
from app.modules.audit_logs.router import router as audit_logs_router
from app.modules.auth.router import router as auth_router
from app.modules.health.router import router as health_router
from app.modules.users.router import router as users_router

router = APIRouter(prefix=settings.api_v1_prefix)

router.include_router(health_router, prefix="/health", tags=["health"])
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(users_router, prefix="/users", tags=["users"])
router.include_router(audit_logs_router, prefix="/audit-logs", tags=["audit-logs"])
