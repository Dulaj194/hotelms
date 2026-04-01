from fastapi import APIRouter

from app.core.config import settings
from app.modules.audit_logs.router import router as audit_logs_router
from app.modules.auth.router import router as auth_router
from app.modules.billing.router import router as billing_router
from app.modules.cart.router import router as cart_router
from app.modules.categories.router import router as categories_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.health.router import router as health_router
from app.modules.housekeeping.router import router as housekeeping_router
from app.modules.items.router import router as items_router
from app.modules.menus.router import router as menus_router
from app.modules.offers.router import router as offers_router
from app.modules.orders.router import router as orders_router
from app.modules.packages.router import router as packages_router
from app.modules.payments.router import router as payments_router
from app.modules.promo_codes.router import router as promo_codes_router
from app.modules.public.router import router as public_router
from app.modules.qr.router import router as qr_router
from app.modules.realtime.router import router as realtime_router
from app.modules.reference_data.router import router as reference_data_router
from app.modules.reports.router import router as reports_router
from app.modules.restaurants.router import router as restaurants_router
from app.modules.room_sessions.router import (
    cart_router as room_cart_router,
    orders_router as room_orders_router,
    session_router as room_sessions_router,
)
from app.modules.rooms.router import router as rooms_router
from app.modules.settings.router import router as settings_router
from app.modules.site_content.router import router as site_content_router
from app.modules.subcategories.router import router as subcategories_router
from app.modules.subscriptions.router import router as subscriptions_router
from app.modules.table_sessions.router import router as table_sessions_router
from app.modules.users.router import router as users_router


router = APIRouter(prefix=settings.api_v1_prefix)

# Core and auth
router.include_router(health_router, prefix="/health", tags=["health"])
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(users_router, prefix="/users", tags=["users"])

# Restaurant catalog
router.include_router(restaurants_router, prefix="/restaurants", tags=["restaurants"])
router.include_router(menus_router, prefix="/menus", tags=["menus"])
router.include_router(categories_router, prefix="/categories", tags=["categories"])
router.include_router(subcategories_router, prefix="/subcategories", tags=["subcategories"])
router.include_router(items_router, prefix="/items", tags=["items"])
router.include_router(offers_router, prefix="/offers", tags=["offers"])
router.include_router(reference_data_router, prefix="/reference-data", tags=["reference-data"])

# Public and guest ordering
router.include_router(public_router, prefix="/public", tags=["public"])
router.include_router(site_content_router, prefix="/public/site", tags=["site-content"])
router.include_router(qr_router, prefix="/qr", tags=["qr"])
router.include_router(table_sessions_router, prefix="/table-sessions", tags=["table-sessions"])
router.include_router(cart_router, prefix="/cart", tags=["cart"])
router.include_router(orders_router, prefix="/orders", tags=["orders"])

# Room operations
router.include_router(rooms_router, prefix="/rooms", tags=["rooms"])
router.include_router(room_sessions_router, prefix="/room-sessions", tags=["room-sessions"])
router.include_router(room_cart_router, prefix="/room-cart", tags=["room-cart"])
router.include_router(room_orders_router, prefix="/room-orders", tags=["room-orders"])
router.include_router(housekeeping_router, prefix="/housekeeping", tags=["housekeeping"])

# SaaS and billing
router.include_router(packages_router, prefix="/packages", tags=["packages"])
router.include_router(subscriptions_router, prefix="/subscriptions", tags=["subscriptions"])
router.include_router(payments_router, prefix="/payments", tags=["payments"])
router.include_router(promo_codes_router, prefix="/promo-codes", tags=["promo-codes"])
router.include_router(billing_router, prefix="/billing", tags=["billing"])

# Ops, reporting, and governance
router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
router.include_router(reports_router, prefix="/reports", tags=["reports"])
router.include_router(settings_router, prefix="/settings", tags=["settings"])
router.include_router(audit_logs_router, prefix="/audit-logs", tags=["audit-logs"])
router.include_router(realtime_router, prefix="/ws", tags=["websocket"])

