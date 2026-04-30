from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.dashboard import repository
from app.modules.dashboard.rules import EXPIRY_THRESHOLD_RULES, MODULE_LANES, SETUP_REQUIREMENT_MATRIX, SLA_PRIORITY_MODEL, get_default_module
from app.modules.dashboard.schemas import (
    AdminDashboardOverviewResponse,
    DashboardAdminUser,
    DashboardAlertAction,
    DashboardAlertItem,
    DashboardModuleLane,
    DashboardOverviewMetrics,
    DashboardPrivilegeMap,
    DashboardRestaurantSummary,
    DashboardSetupRequirement,
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
    return value.astimezone(UTC).replace(tzinfo=None)


def _calculate_days_remaining(expires_at: datetime | None) -> int | None:
    if expires_at is None:
        return None
    now = datetime.now(UTC).replace(tzinfo=None)
    normalized_expiry = _normalize_datetime(expires_at)
    if normalized_expiry is None:
        return None
    return (normalized_expiry.date() - now.date()).days


def _build_setup_requirements(restaurant: Restaurant) -> tuple[list[DashboardSetupRequirement], list[str], bool]:
    requirements: list[DashboardSetupRequirement] = []
    missing_keys: list[str] = []
    has_blocking_missing = False

    for item in SETUP_REQUIREMENT_MATRIX:
        field_value = getattr(restaurant, item["key"], None)
        completed = bool(field_value and str(field_value).strip())

        if not completed:
            missing_keys.append(item["key"])
            if item["severity"] == "blocking":
                has_blocking_missing = True

        requirements.append(
            DashboardSetupRequirement(
                key=item["key"],
                label=item["label"],
                severity=item["severity"],
                description=item["description"],
                completed=completed,
            )
        )

    return requirements, missing_keys, has_blocking_missing


def _get_first_pending_step(requirements: list[DashboardSetupRequirement]) -> int:
    for index, requirement in enumerate(requirements, start=1):
        if not requirement.completed:
            return index
    return len(requirements) if requirements else 1


def _normalize_current_setup_step(
    requirements: list[DashboardSetupRequirement],
    persisted_step: int | None,
) -> int:
    if not requirements:
        return 1

    total_steps = len(requirements)
    first_pending_step = _get_first_pending_step(requirements)
    has_pending = any(not requirement.completed for requirement in requirements)

    if not has_pending:
        return total_steps

    raw_step = persisted_step if isinstance(persisted_step, int) else 1
    clamped_step = min(max(raw_step, 1), total_steps)

    # Keep wizard anchored to actionable work; skip stale completed steps.
    if requirements[clamped_step - 1].completed:
        return first_pending_step

    return clamped_step


def _build_module_lanes(*, role: str, privileges: list[str]) -> list[DashboardModuleLane]:
    normalized_privileges = {p.upper() for p in privileges}
    lanes: list[DashboardModuleLane] = []

    for lane in MODULE_LANES:
        role_ok = role in lane["required_roles"]
        privilege_ok = all(req.upper() in normalized_privileges for req in lane["required_privileges"])
        lanes.append(
            DashboardModuleLane(
                key=lane["key"],
                label=lane["label"],
                path=lane["path"],
                visible=role_ok and privilege_ok,
            )
        )

    return lanes


def _build_expiry_alerts(
    db: Session,
    *,
    restaurant_id: int,
    days_remaining: int | None,
    is_trial: bool,
) -> list[DashboardAlertItem]:
    if not is_trial or days_remaining is None or days_remaining > 7:
        return []

    alerts: list[DashboardAlertItem] = []
    today = datetime.now(UTC).date()
    now = datetime.now(UTC)

    for rule in EXPIRY_THRESHOLD_RULES:
        if days_remaining <= rule.max_days:
            impression = repository.get_alert_impression_for_day(
                db,
                restaurant_id=restaurant_id,
                alert_key=rule.key,
                shown_date=today,
            )

            dismissed = bool(impression and impression.dismissed_until and impression.dismissed_until > now)
            should_show = rule.blocking or not dismissed

            if days_remaining < 0 or rule.key == "trial-expired":
                message = "Trial has expired. Renew to continue using subscription features."
            else:
                message = f"Trial expires in {days_remaining} day(s)."

            alerts.append(
                DashboardAlertItem(
                    key=rule.key,
                    level=rule.level,
                    title="Subscription Alert",
                    message=message,
                    blocking=rule.blocking,
                    should_show=should_show,
                    dismissible=not rule.blocking and rule.dismiss_hours > 0,
                    visibility_policy="first_login_of_day",
                    action=DashboardAlertAction(label=rule.cta_label, path=rule.cta_path),
                )
            )
            break

    return alerts


def _build_metrics(db: Session, *, restaurant_id: int) -> DashboardOverviewMetrics:
    now = datetime.now(UTC)
    overdue_cutoff = now - timedelta(minutes=30)
    today_start = datetime(now.year, now.month, now.day)

    pending_orders = (
        db.query(func.count(OrderHeader.id))
        .filter(OrderHeader.restaurant_id == restaurant_id, OrderHeader.status == OrderStatus.pending)
        .scalar()
        or 0
    )
    overdue_orders = (
        db.query(func.count(OrderHeader.id))
        .filter(
            OrderHeader.restaurant_id == restaurant_id,
            OrderHeader.status == OrderStatus.pending,
            OrderHeader.placed_at < overdue_cutoff,
        )
        .scalar()
        or 0
    )
    today_orders = (
        db.query(func.count(OrderHeader.id))
        .filter(OrderHeader.restaurant_id == restaurant_id, OrderHeader.placed_at >= today_start)
        .scalar()
        or 0
    )
    pending_housekeeping = (
        db.query(func.count(HousekeepingRequest.id))
        .filter(
            HousekeepingRequest.restaurant_id == restaurant_id,
            HousekeepingRequest.status.notin_(["ready", "cancelled", "done"]),
        )
        .scalar()
        or 0
    )

    exception_count = int(overdue_orders) + int(pending_housekeeping)

    return DashboardOverviewMetrics(
        pending_orders=int(pending_orders),
        overdue_orders=int(overdue_orders),
        today_orders=int(today_orders),
        exception_count=exception_count,
        pending_housekeeping_tasks=int(pending_housekeeping),
    )


def get_admin_dashboard_overview(
    db: Session,
    *,
    restaurant_id: int,
    role: str,
) -> AdminDashboardOverviewResponse:
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant profile not found for this account.",
        )

    current_subscription = subscriptions_service.get_current_subscription(db, restaurant_id)
    privileges_response = subscriptions_service.get_effective_privileges(db, restaurant_id)

    expiry_point = current_subscription.trial_expires_at or current_subscription.expires_at
    days_remaining = _calculate_days_remaining(expiry_point)

    requirements, missing_fields, has_blocking_missing = _build_setup_requirements(restaurant)

    setup_progress = repository.get_setup_progress(db, restaurant_id=restaurant_id)
    completed_keys = [requirement.key for requirement in requirements if requirement.completed]
    total_steps = len(requirements)
    completed_count = len([req for req in requirements if req.completed])
    progress_percent = int((completed_count / total_steps) * 100) if total_steps else 100
    normalized_current_step = _normalize_current_setup_step(
        requirements,
        setup_progress.current_step if setup_progress else None,
    )

    alerts = _build_expiry_alerts(
        db,
        restaurant_id=restaurant_id,
        days_remaining=days_remaining,
        is_trial=current_subscription.is_trial,
    )

    admin_users = (
        db.query(User)
        .filter(User.restaurant_id == restaurant_id, User.role.in_([UserRole.owner, UserRole.admin]))
        .order_by(User.id.asc())
        .all()
    )

    metrics = _build_metrics(db, restaurant_id=restaurant_id)

    module_lanes = _build_module_lanes(role=role, privileges=privileges_response.privileges)
    default_module = get_default_module(privileges_response.privileges, role=role)

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
            billing_email=restaurant.billing_email or restaurant.email,
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
        metrics=metrics,
        warnings=DashboardWarningSummary(
            trial_expiry_warning=any(alert.should_show for alert in alerts),
            trial_expiry_message=alerts[0].message if alerts else None,
        ),
        alerts=alerts,
        setup_wizard=DashboardSetupWizardSummary(
            should_show=len(missing_fields) > 0,
            has_blocking_missing=has_blocking_missing,
            progress_percent=progress_percent,
            current_step=normalized_current_step,
            total_steps=total_steps,
            completed_keys=completed_keys,
            missing_fields=missing_fields,
        ),
        setup_requirements=requirements,
        module_lanes=module_lanes,
        privilege_map=DashboardPrivilegeMap(role=role, privileges=privileges_response.privileges),
        sla_priority_model=SLA_PRIORITY_MODEL,
        default_module=default_module,
    )
