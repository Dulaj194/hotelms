# Import all ORM models here so SQLAlchemy Base.metadata is fully populated.
# This file must be imported once at startup to enable:
#   - Base.metadata.create_all()  (development table creation)
#   - Alembic autogenerate        (migration generation)

from app.modules.audit_logs.model import AuditLog, SuperAdminNotificationState  # noqa: F401
from app.modules.auth.model import PasswordResetToken  # noqa: F401
from app.modules.billing.model import Bill, BillWorkflowEvent  # noqa: F401
from app.modules.categories.model import Category  # noqa: F401
from app.modules.dashboard.model import DashboardAlertImpression, DashboardSetupProgress  # noqa: F401
from app.modules.items.model import Item  # noqa: F401
from app.modules.menus.model import Menu  # noqa: F401
from app.modules.orders.model import OrderHeader, OrderItem  # noqa: F401
from app.modules.offers.model import Offer  # noqa: F401
from app.modules.packages.model import Package, PackagePrivilege  # noqa: F401
from app.modules.payments.model import BillingTransaction, Payment, ProcessedWebhookEvent  # noqa: F401
from app.modules.promo_codes.model import PromoCode, PromoCodeUsage  # noqa: F401
from app.modules.qr.model import QRCode  # noqa: F401
from app.modules.reference_data.model import Country, CurrencyType  # noqa: F401
from app.modules.reports.model import ReportHistory  # noqa: F401
from app.modules.restaurants.model import (  # noqa: F401
    Restaurant,
    RestaurantPasswordRevealToken,
    RestaurantWebhookDelivery,
)
from app.modules.housekeeping.model import HousekeepingRequest  # noqa: F401
from app.modules.settings.model import SettingsRequest  # noqa: F401
from app.modules.site_content.model import ContactLead, SiteBlogPost, SitePage  # noqa: F401
from app.modules.subcategories.model import Subcategory  # noqa: F401
from app.modules.subscriptions.model import RestaurantSubscription, SubscriptionChangeLog  # noqa: F401
from app.modules.room_sessions.model import RoomSession  # noqa: F401
from app.modules.rooms.model import Room  # noqa: F401
from app.modules.table_sessions.model import TableSession  # noqa: F401
from app.modules.users.model import User  # noqa: F401
