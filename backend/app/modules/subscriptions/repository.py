from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.packages.model import PackagePrivilege
from app.modules.subscriptions.model import RestaurantSubscription, SubscriptionStatus


def get_latest_subscription_by_restaurant(
    db: Session,
    restaurant_id: int,
) -> RestaurantSubscription | None:
    return (
        db.query(RestaurantSubscription)
        .filter(RestaurantSubscription.restaurant_id == restaurant_id)
        .order_by(RestaurantSubscription.started_at.desc(), RestaurantSubscription.id.desc())
        .first()
    )


def get_current_open_subscription_by_restaurant(
    db: Session,
    restaurant_id: int,
) -> RestaurantSubscription | None:
    return (
        db.query(RestaurantSubscription)
        .filter(
            RestaurantSubscription.restaurant_id == restaurant_id,
            RestaurantSubscription.status.in_([SubscriptionStatus.trial, SubscriptionStatus.active]),
        )
        .order_by(RestaurantSubscription.started_at.desc(), RestaurantSubscription.id.desc())
        .first()
    )


def has_trial_history_by_restaurant(db: Session, restaurant_id: int) -> bool:
    count = (
        db.query(func.count(RestaurantSubscription.id))
        .filter(
            RestaurantSubscription.restaurant_id == restaurant_id,
            RestaurantSubscription.is_trial.is_(True),
        )
        .scalar()
    )
    return bool(count and count > 0)


def create_subscription(
    db: Session,
    *,
    restaurant_id: int,
    package_id: int,
    status: SubscriptionStatus,
    started_at: datetime,
    expires_at: datetime,
    is_trial: bool,
    trial_started_at: datetime | None,
    trial_expires_at: datetime | None,
) -> RestaurantSubscription:
    subscription = RestaurantSubscription(
        restaurant_id=restaurant_id,
        package_id=package_id,
        status=status,
        started_at=started_at,
        expires_at=expires_at,
        is_trial=is_trial,
        trial_started_at=trial_started_at,
        trial_expires_at=trial_expires_at,
    )
    db.add(subscription)
    db.flush()
    db.refresh(subscription)
    return subscription


def close_open_subscriptions(
    db: Session,
    restaurant_id: int,
    *,
    closed_status: SubscriptionStatus,
    closed_at: datetime,
) -> int:
    subscriptions = (
        db.query(RestaurantSubscription)
        .filter(
            RestaurantSubscription.restaurant_id == restaurant_id,
            RestaurantSubscription.status.in_([SubscriptionStatus.trial, SubscriptionStatus.active]),
        )
        .all()
    )
    for subscription in subscriptions:
        subscription.status = closed_status
        subscription.expires_at = closed_at
    if subscriptions:
        db.flush()
    return len(subscriptions)


def list_package_privilege_codes(db: Session, package_id: int) -> Sequence[str]:
    rows = (
        db.query(PackagePrivilege.privilege_code)
        .filter(PackagePrivilege.package_id == package_id)
        .all()
    )
    return [row[0] for row in rows]
