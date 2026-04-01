from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.access import catalog as access_catalog
from app.modules.packages import catalog as packages_catalog
from app.modules.packages import repository as packages_repo
from app.modules.packages import service as packages_service
from app.modules.restaurants import repository as restaurants_repo
from app.modules.subscriptions import repository
from app.modules.subscriptions.model import RestaurantSubscription, SubscriptionStatus
from app.modules.subscriptions.schemas import (
    ActivateSubscriptionRequest,
    ActivateSubscriptionResponse,
    CancelSubscriptionResponse,
    StartTrialResponse,
    SubscriptionAccessFeatureFlagResponse,
    SubscriptionAccessModuleResponse,
    SubscriptionAccessPrivilegeResponse,
    SubscriptionAccessSummaryResponse,
    SubscriptionPrivilegeResponse,
    SubscriptionResponse,
    SubscriptionStatusResponse,
)


def _utcnow_naive() -> datetime:
    return datetime.utcnow()


def _normalize_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _effective_status(subscription: RestaurantSubscription | None) -> str:
    if subscription is None:
        return "none"

    now = _utcnow_naive()
    effective_expires_at = subscription.trial_expires_at if subscription.is_trial else subscription.expires_at
    effective_expires_at = _normalize_datetime(effective_expires_at)

    if subscription.status in (SubscriptionStatus.active, SubscriptionStatus.trial):
        if effective_expires_at and effective_expires_at <= now:
            return SubscriptionStatus.expired.value

    return subscription.status.value


def _to_subscription_response(subscription: RestaurantSubscription | None) -> SubscriptionResponse:
    if subscription is None:
        return SubscriptionResponse(
            id=None,
            restaurant_id=0,
            package_id=None,
            package_name=None,
            package_code=None,
            status="none",
            is_trial=False,
            started_at=None,
            expires_at=None,
            trial_started_at=None,
            trial_expires_at=None,
        )

    return SubscriptionResponse(
        id=subscription.id,
        restaurant_id=subscription.restaurant_id,
        package_id=subscription.package_id,
        package_name=subscription.package.name if subscription.package else None,
        package_code=subscription.package.code if subscription.package else None,
        status=_effective_status(subscription),
        is_trial=subscription.is_trial,
        started_at=subscription.started_at,
        expires_at=subscription.expires_at,
        trial_started_at=subscription.trial_started_at,
        trial_expires_at=subscription.trial_expires_at,
    )


def _prettify_code(value: str) -> str:
    return value.replace("_", " ").title()


def _serialize_access_module(
    module: access_catalog.AccessModuleDefinition,
    *,
    enabled_by_package: bool,
    enabled_by_feature_flags: bool,
) -> SubscriptionAccessModuleResponse:
    return SubscriptionAccessModuleResponse(
        key=module.key,
        label=module.label,
        description=module.description,
        package_privileges=list(module.package_privileges),
        feature_flags=[
            access_catalog.get_feature_flag_key(code) for code in module.feature_flags
        ],
        enabled_by_package=enabled_by_package,
        enabled_by_feature_flags=enabled_by_feature_flags,
        is_enabled=enabled_by_package and enabled_by_feature_flags,
    )


def _serialize_access_privilege(code: str) -> SubscriptionAccessPrivilegeResponse:
    definition = packages_catalog.get_privilege_definition(code)
    if definition is None:
        return SubscriptionAccessPrivilegeResponse(
            code=code.upper(),
            label=_prettify_code(code),
            description="Custom privilege configured for this package.",
            modules=[],
        )

    return SubscriptionAccessPrivilegeResponse(
        code=definition.code,
        label=definition.label,
        description=definition.description,
        modules=[
            _serialize_access_module(
                module,
                enabled_by_package=True,
                enabled_by_feature_flags=True,
            )
            for module in definition.modules
            if module is not None
        ],
    )


def _serialize_feature_flag(
    definition: access_catalog.RestaurantFeatureFlagDefinition,
    *,
    enabled: bool,
) -> SubscriptionAccessFeatureFlagResponse:
    return SubscriptionAccessFeatureFlagResponse(
        code=definition.code,
        key=definition.key,
        label=definition.label,
        description=definition.description,
        enabled=enabled,
        modules=[
            _serialize_access_module(
                module,
                enabled_by_package=True,
                enabled_by_feature_flags=enabled,
            )
            for module_key in definition.modules
            if (module := access_catalog.get_module_definition(module_key)) is not None
        ],
    )


def _is_module_enabled_by_package(
    module: access_catalog.AccessModuleDefinition,
    privilege_codes: list[str],
) -> bool:
    if not module.package_privileges:
        return True

    normalized_privileges = {code.strip().upper() for code in privilege_codes}
    return any(code.upper() in normalized_privileges for code in module.package_privileges)


def get_current_subscription_entity(
    db: Session,
    restaurant_id: int,
) -> RestaurantSubscription | None:
    return repository.get_latest_subscription_by_restaurant(db, restaurant_id)


def get_current_subscription(
    db: Session,
    restaurant_id: int,
) -> SubscriptionResponse:
    subscription = get_current_subscription_entity(db, restaurant_id)
    response = _to_subscription_response(subscription)
    if response.id is None:
        response.restaurant_id = restaurant_id
    return response


def get_current_subscription_status(
    db: Session,
    restaurant_id: int,
) -> SubscriptionStatusResponse:
    subscription = get_current_subscription_entity(db, restaurant_id)
    status_value = _effective_status(subscription)

    if subscription is None:
        return SubscriptionStatusResponse(
            status="none",
            is_active=False,
            is_trial=False,
            is_expired=False,
            started_at=None,
            expires_at=None,
        )

    return SubscriptionStatusResponse(
        status=status_value,
        is_active=status_value in {SubscriptionStatus.active.value, SubscriptionStatus.trial.value},
        is_trial=subscription.is_trial,
        is_expired=status_value == SubscriptionStatus.expired.value,
        started_at=subscription.started_at,
        expires_at=subscription.expires_at,
    )


def get_effective_privileges(
    db: Session,
    restaurant_id: int,
) -> SubscriptionPrivilegeResponse:
    subscription = get_current_subscription_entity(db, restaurant_id)
    status_value = _effective_status(subscription)

    privileges: list[str] = []
    if subscription and status_value in {SubscriptionStatus.active.value, SubscriptionStatus.trial.value}:
        privileges = list(repository.list_package_privilege_codes(db, subscription.package_id))

    return SubscriptionPrivilegeResponse(
        restaurant_id=restaurant_id,
        status=status_value,
        privileges=sorted(set(privileges)),
    )


def get_package_access_summary(
    db: Session,
    restaurant_id: int,
) -> SubscriptionAccessSummaryResponse:
    subscription = get_current_subscription_entity(db, restaurant_id)
    status_response = get_current_subscription_status(db, restaurant_id)
    privilege_response = get_effective_privileges(db, restaurant_id)
    restaurant = restaurants_repo.get_by_id(db, restaurant_id)
    if restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )

    feature_flag_snapshot = access_catalog.build_feature_flag_snapshot(restaurant)
    module_access = [
        _serialize_access_module(
            module,
            enabled_by_package=_is_module_enabled_by_package(module, privilege_response.privileges),
            enabled_by_feature_flags=access_catalog.is_module_enabled_by_feature_flags(
                module,
                feature_flag_snapshot,
            ),
        )
        for module in access_catalog.list_module_definitions()
    ]

    enabled_modules = [
        module for module in module_access if module.is_enabled
    ]
    privileges = [
        _serialize_access_privilege(code) for code in privilege_response.privileges
    ]
    feature_flags = [
        _serialize_feature_flag(
            definition,
            enabled=feature_flag_snapshot[definition.key],
        )
        for definition in access_catalog.list_feature_flag_definitions()
    ]

    return SubscriptionAccessSummaryResponse(
        restaurant_id=restaurant_id,
        status=status_response.status,
        is_active=status_response.is_active,
        package_id=subscription.package_id if subscription else None,
        package_name=subscription.package.name if subscription and subscription.package else None,
        package_code=subscription.package.code if subscription and subscription.package else None,
        privileges=privileges,
        feature_flags=feature_flags,
        module_access=module_access,
        enabled_modules=enabled_modules,
    )


def has_privilege(
    db: Session,
    restaurant_id: int,
    privilege_code: str,
) -> bool:
    privilege_response = get_effective_privileges(db, restaurant_id)
    required = privilege_code.upper()
    return required in {p.upper() for p in privilege_response.privileges}


def assert_privilege(
    db: Session,
    restaurant_id: int,
    privilege_code: str,
) -> None:
    status_response = get_current_subscription_status(db, restaurant_id)
    if status_response.status == "none":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No subscription found for this restaurant.",
        )

    if status_response.is_expired:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your subscription has expired. Please activate a package.",
        )

    if status_response.status == SubscriptionStatus.cancelled.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your subscription is cancelled. Please activate a package.",
        )

    if not has_privilege(db, restaurant_id, privilege_code):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your current package does not include '{privilege_code.upper()}'.",
        )


def has_module_access(
    db: Session,
    restaurant_id: int,
    module_key: str,
) -> bool:
    normalized_key = module_key.strip().lower()
    summary = get_package_access_summary(db, restaurant_id)
    return any(item.key == normalized_key and item.is_enabled for item in summary.module_access)


def assert_module_access(
    db: Session,
    restaurant_id: int,
    module_key: str,
) -> None:
    definition = access_catalog.get_module_definition(module_key)
    if definition is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown module '{module_key}'.",
        )

    status_response = get_current_subscription_status(db, restaurant_id)
    if definition.package_privileges:
        if status_response.status == "none":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No subscription found for this restaurant.",
            )

        if status_response.is_expired:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your subscription has expired. Please activate a package.",
            )

        if status_response.status == SubscriptionStatus.cancelled.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your subscription is cancelled. Please activate a package.",
            )

    summary = get_package_access_summary(db, restaurant_id)
    module = next(
        (item for item in summary.module_access if item.key == definition.key),
        None,
    )
    if module is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown module '{module_key}'.",
        )

    if not module.enabled_by_package:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your current package does not include access to '{module.label}'.",
        )

    if not module.enabled_by_feature_flags:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"The '{module.label}' module is disabled for this restaurant.",
        )


def _get_active_package_by_selector(
    db: Session,
    payload: ActivateSubscriptionRequest,
):
    package = None
    if payload.package_id is not None:
        package = packages_repo.get_package_by_id(db, payload.package_id)
    elif payload.package_code:
        package = packages_repo.get_package_by_code(db, payload.package_code.strip().lower())

    if package is None or not package.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found or inactive.",
        )

    return package


def assign_initial_trial_subscription(
    db: Session,
    restaurant_id: int,
    *,
    commit: bool = True,
) -> None:
    existing = repository.get_latest_subscription_by_restaurant(db, restaurant_id)
    if existing is not None:
        return

    packages_service.ensure_default_packages(db, commit=False)
    trial_package = packages_repo.get_package_by_code(db, settings.default_trial_package_code)
    if trial_package is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Default trial package is not configured.",
        )

    now = _utcnow_naive()
    trial_end = now + timedelta(days=settings.default_trial_days)

    repository.create_subscription(
        db,
        restaurant_id=restaurant_id,
        package_id=trial_package.id,
        status=SubscriptionStatus.trial,
        started_at=now,
        expires_at=trial_end,
        is_trial=True,
        trial_started_at=now,
        trial_expires_at=trial_end,
    )
    if commit:
        db.commit()


def start_trial(
    db: Session,
    restaurant_id: int,
) -> StartTrialResponse:
    if repository.has_trial_history_by_restaurant(db, restaurant_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Trial already used for this restaurant.",
        )

    current_open = repository.get_current_open_subscription_by_restaurant(db, restaurant_id)
    if current_open is not None and _effective_status(current_open) in {
        SubscriptionStatus.active.value,
        SubscriptionStatus.trial.value,
    }:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An active or trial subscription already exists.",
        )

    packages_service.ensure_default_packages(db)
    trial_package = packages_repo.get_package_by_code(db, settings.default_trial_package_code)
    if trial_package is None or not trial_package.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Default trial package is unavailable.",
        )

    now = _utcnow_naive()
    trial_end = now + timedelta(days=settings.default_trial_days)

    repository.close_open_subscriptions(
        db,
        restaurant_id,
        closed_status=SubscriptionStatus.cancelled,
        closed_at=now,
    )

    subscription = repository.create_subscription(
        db,
        restaurant_id=restaurant_id,
        package_id=trial_package.id,
        status=SubscriptionStatus.trial,
        started_at=now,
        expires_at=trial_end,
        is_trial=True,
        trial_started_at=now,
        trial_expires_at=trial_end,
    )
    db.commit()

    return StartTrialResponse(
        message="Trial started successfully.",
        subscription=_to_subscription_response(subscription),
    )


def activate_subscription(
    db: Session,
    restaurant_id: int,
    payload: ActivateSubscriptionRequest,
) -> ActivateSubscriptionResponse:
    packages_service.ensure_default_packages(db)
    package = _get_active_package_by_selector(db, payload)

    subscription = activate_paid_subscription(db, restaurant_id=restaurant_id, package_id=package.id)
    db.commit()

    return ActivateSubscriptionResponse(
        message="Subscription activated successfully.",
        subscription=_to_subscription_response(subscription),
    )


def activate_paid_subscription(
    db: Session,
    *,
    restaurant_id: int,
    package_id: int,
) -> RestaurantSubscription:
    package = packages_repo.get_package_by_id(db, package_id)
    if package is None or not package.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found or inactive.",
        )

    now = _utcnow_naive()
    expires_at = now + timedelta(days=package.billing_period_days)

    repository.close_open_subscriptions(
        db,
        restaurant_id,
        closed_status=SubscriptionStatus.cancelled,
        closed_at=now,
    )

    return repository.create_subscription(
        db,
        restaurant_id=restaurant_id,
        package_id=package.id,
        status=SubscriptionStatus.active,
        started_at=now,
        expires_at=expires_at,
        is_trial=False,
        trial_started_at=None,
        trial_expires_at=None,
    )


def cancel_subscription(
    db: Session,
    restaurant_id: int,
) -> CancelSubscriptionResponse:
    current_open = repository.get_current_open_subscription_by_restaurant(db, restaurant_id)
    if current_open is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active subscription to cancel.",
        )

    now = _utcnow_naive()
    current_open.status = SubscriptionStatus.cancelled
    current_open.expires_at = now
    db.commit()

    return CancelSubscriptionResponse(
        message="Subscription cancelled successfully.",
        status="cancelled",
    )


# ─── Super-admin operations ───────────────────────────────────────────────────


def expire_overdue_subscriptions(db: Session) -> int:
    """Persist expired status for all active/trial subscriptions past their expiry.

    Called by the background worker and the manual super_admin trigger endpoint.
    Returns the number of subscriptions that were updated.
    """
    overdue = repository.get_overdue_open_subscriptions(db)
    for sub in overdue:
        sub.status = SubscriptionStatus.expired
    if overdue:
        db.commit()
    return len(overdue)


def get_subscription_for_super_admin(
    db: Session, restaurant_id: int
) -> SubscriptionResponse:
    """Return the current subscription for any restaurant (super_admin only)."""
    subscription = repository.get_latest_subscription_by_restaurant(db, restaurant_id)
    response = _to_subscription_response(subscription)
    if response.id is None:
        response.restaurant_id = restaurant_id
    return response


def update_subscription_for_super_admin(
    db: Session,
    restaurant_id: int,
    payload: "SuperAdminSubscriptionUpdateRequest",
) -> SubscriptionResponse:
    """Allow super_admin to update status / expiry / package for any restaurant.

    When updating expires_at on a trial subscription, trial_expires_at is
    updated too so that _effective_status() stays consistent.
    """
    from app.modules.subscriptions.schemas import SuperAdminSubscriptionUpdateRequest  # noqa: F401

    subscription = repository.get_latest_subscription_by_restaurant(db, restaurant_id)
    if subscription is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No subscription found for this restaurant.",
        )

    update_data: dict = {}

    if payload.status is not None:
        try:
            update_data["status"] = SubscriptionStatus(payload.status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid status value '{payload.status}'. "
                f"Allowed: trial, active, expired, cancelled.",
            ) from None

    if payload.expires_at is not None:
        naive_expiry = _normalize_datetime(payload.expires_at)
        update_data["expires_at"] = naive_expiry
        # Keep trial_expires_at in sync for trial subscriptions.
        if subscription.is_trial:
            update_data["trial_expires_at"] = naive_expiry

    if payload.package_id is not None:
        package = packages_repo.get_package_by_id(db, payload.package_id)
        if package is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Package not found.",
            )
        update_data["package_id"] = payload.package_id

    updated = repository.update_subscription_by_id(db, subscription.id, update_data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found.",
        )
    return _to_subscription_response(updated)


def get_package_access_summary_for_super_admin(
    db: Session,
    restaurant_id: int,
) -> SubscriptionAccessSummaryResponse:
    restaurant = restaurants_repo.get_by_id_for_super_admin(db, restaurant_id)
    if restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    return get_package_access_summary(db, restaurant_id)
