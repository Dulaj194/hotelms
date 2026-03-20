from __future__ import annotations

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.dashboard.schemas import (
    AdminDashboardOverviewResponse,
    DashboardAdminUser,
    DashboardOverviewMetrics,
    DashboardRestaurantSummary,
    DashboardSetupWizardSummary,
    DashboardSubscriptionSummary,
    DashboardWarningSummary,
)
from app.modules.housekeeping.model import HousekeepingRequest
from app.modules.orders.model import OrderHeader, OrderStatus
from app.modules.restaurants.model import Restaurant
from app.modules.subscriptions import service as subscriptions_service
from app.modules.users.model import User, UserRole


def _normalize_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.replace(tzinfo=None)


def _calculate_days_remaining(expires_at: datetime | None) -> int | None:
    if expires_at is None:
        return None
    now = datetime.utcnow()
    normalized_expiry = _normalize_datetime(expires_at)
    if normalized_expiry is None:
        return None
    delta_days = (normalized_expiry.date() - now.date()).days
    return max(delta_days, 0)


def get_admin_dashboard_overview(
    db: Session,
    *,
    restaurant_id: int,
) -> AdminDashboardOverviewResponse:
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if restaurant is None:
        raise ValueError("Restaurant not found.")

    current_subscription = subscriptions_service.get_current_subscription(db, restaurant_id)
    privileges_response = subscriptions_service.get_effective_privileges(db, restaurant_id)

    expiry_point = current_subscription.trial_expires_at or current_subscription.expires_at
    days_remaining = _calculate_days_remaining(expiry_point)

    trial_expiry_warning = bool(current_subscription.is_trial and days_remaining is not None and days_remaining <= 5)
    warning_message = (
        f"Trial expires in {days_remaining} day(s). Please activate a package."
        if trial_expiry_warning
        else None
    )

    admin_users = (
        db.query(User)
        .filter(
            User.restaurant_id == restaurant_id,
            User.role.in_([UserRole.owner, UserRole.admin]),
        )
        .order_by(User.id.asc())
        .all()
    )

    pending_orders = (
        db.query(func.count(OrderHeader.id))
        .filter(
            OrderHeader.restaurant_id == restaurant_id,
            OrderHeader.status == OrderStatus.pending,
        )
        .scalar()
        or 0
    )

    pending_housekeeping = (
        db.query(func.count(HousekeepingRequest.id))
        .filter(
            HousekeepingRequest.restaurant_id == restaurant_id,
            HousekeepingRequest.status == "pending",
        )
        .scalar()
        or 0
    )

    missing_fields: list[str] = []
    if not restaurant.country:
        missing_fields.append("country")
    if not restaurant.currency:
        missing_fields.append("currency")

    return AdminDashboardOverviewResponse(
        restaurant=DashboardRestaurantSummary(
            id=restaurant.id,
            name=restaurant.name,
            email=restaurant.email,
            contact_number=restaurant.phone,
            address=restaurant.address,
            logo_url=restaurant.logo_url,
            country=restaurant.country,
            currency=restaurant.currency,
            opening_time=restaurant.opening_time,
            closing_time=restaurant.closing_time,
        ),
        subscription=DashboardSubscriptionSummary(
            status=current_subscription.status,
            is_trial=current_subscription.is_trial,
            package_name=current_subscription.package_name,
            package_code=current_subscription.package_code,
            trial_expires_at=current_subscription.trial_expires_at,
            days_remaining=days_remaining,
            privileges=privileges_response.privileges,
        ),
        admins=[
            DashboardAdminUser(
                id=admin.id,
                full_name=admin.full_name,
                email=admin.email,
                role=admin.role.value,
                is_active=admin.is_active,
            )
            for admin in admin_users
        ],
        metrics=DashboardOverviewMetrics(
            pending_orders=int(pending_orders),
            pending_housekeeping_tasks=int(pending_housekeeping),
        ),
        warnings=DashboardWarningSummary(
            trial_expiry_warning=trial_expiry_warning,
            trial_expiry_message=warning_message,
        ),
        setup_wizard=DashboardSetupWizardSummary(
            should_show=len(missing_fields) > 0,
            missing_fields=missing_fields,
        ),
    )
