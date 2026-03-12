from fastapi import APIRouter

from app.core.config import settings
from app.modules.audit_logs.router import router as audit_logs_router
from app.modules.auth.router import router as auth_router
from app.modules.billing.router import router as billing_router
from app.modules.cart.router import router as cart_router
from app.modules.categories.router import router as categories_router
from app.modules.health.router import router as health_router
from app.modules.items.router import router as items_router
from app.modules.orders.router import router as orders_router
from app.modules.payments.router import router as payments_router
from app.modules.public.router import router as public_router
from app.modules.qr.router import router as qr_router
from app.modules.realtime.router import router as realtime_router
from app.modules.restaurants.router import router as restaurants_router
from app.modules.table_sessions.router import router as table_sessions_router
from app.modules.users.router import router as users_router

router = APIRouter(prefix=settings.api_v1_prefix)

router.include_router(health_router, prefix="/health", tags=["health"])
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(users_router, prefix="/users", tags=["users"])
router.include_router(restaurants_router, prefix="/restaurants", tags=["restaurants"])
router.include_router(categories_router, prefix="/categories", tags=["categories"])
router.include_router(items_router, prefix="/items", tags=["items"])
router.include_router(public_router, prefix="/public", tags=["public"])
router.include_router(qr_router, prefix="/qr", tags=["qr"])
router.include_router(table_sessions_router, prefix="/table-sessions", tags=["table-sessions"])
router.include_router(cart_router, prefix="/cart", tags=["cart"])
router.include_router(orders_router, prefix="/orders", tags=["orders"])
router.include_router(payments_router, prefix="/payments", tags=["payments"])
router.include_router(audit_logs_router, prefix="/audit-logs", tags=["audit-logs"])
router.include_router(realtime_router, prefix="/ws", tags=["websocket"])
router.include_router(billing_router, prefix="/billing", tags=["billing"])
