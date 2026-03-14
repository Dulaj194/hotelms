from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.packages import repository as packages_repo
from app.modules.packages import service as packages_service
from app.modules.subscriptions import repository
from app.modules.subscriptions.model import RestaurantSubscription, SubscriptionStatus
from app.modules.subscriptions.schemas import (
    ActivateSubscriptionRequest,
    ActivateSubscriptionResponse,
    CancelSubscriptionResponse,
    StartTrialResponse,
    SubscriptionPrivilegeResponse,
    SubscriptionResponse,
    SubscriptionStatusResponse,
)


def _effective_status(subscription: RestaurantSubscription | None) -> str:
    if subscription is None:
        return "none"

    now = datetime.now(UTC)
    effective_expires_at = subscription.trial_expires_at if subscription.is_trial else subscription.expires_at

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


def assign_initial_trial_subscription(db: Session, restaurant_id: int) -> None:
    existing = repository.get_latest_subscription_by_restaurant(db, restaurant_id)
    if existing is not None:
        return

    packages_service.ensure_default_packages(db)
    trial_package = packages_repo.get_package_by_code(db, settings.default_trial_package_code)
    if trial_package is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Default trial package is not configured.",
        )

    now = datetime.now(UTC)
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

    now = datetime.now(UTC)
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

    now = datetime.now(UTC)
    expires_at = now + timedelta(days=package.billing_period_days)

    repository.close_open_subscriptions(
        db,
        restaurant_id,
        closed_status=SubscriptionStatus.cancelled,
        closed_at=now,
    )

    subscription = repository.create_subscription(
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
    db.commit()

    return ActivateSubscriptionResponse(
        message="Subscription activated successfully.",
        subscription=_to_subscription_response(subscription),
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

    now = datetime.now(UTC)
    current_open.status = SubscriptionStatus.cancelled
    current_open.expires_at = now
    db.commit()

    return CancelSubscriptionResponse(
        message="Subscription cancelled successfully.",
        status="cancelled",
    )
