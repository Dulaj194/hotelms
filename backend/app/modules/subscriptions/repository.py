import json
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.packages.model import PackagePrivilege
from app.modules.subscriptions.model import (
    RestaurantSubscription,
    SubscriptionChangeAction,
    SubscriptionChangeLog,
    SubscriptionStatus,
)


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


# ─── Super-admin bulk operations ──────────────────────────────────────────────


def get_overdue_open_subscriptions(
    db: Session,
) -> list[RestaurantSubscription]:
    """Return all active/trial subscriptions whose expiry has passed."""
    now = datetime.utcnow()
    return (
        db.query(RestaurantSubscription)
        .filter(
            RestaurantSubscription.status.in_(
                [SubscriptionStatus.active, SubscriptionStatus.trial]
            ),
            RestaurantSubscription.expires_at <= now,
        )
        .all()
    )


def update_subscription_by_id(
    db: Session,
    subscription_id: int,
    update_data: dict,
) -> RestaurantSubscription | None:
    """Update arbitrary fields on a subscription. For super_admin use only."""
    sub = (
        db.query(RestaurantSubscription)
        .filter(RestaurantSubscription.id == subscription_id)
        .first()
    )
    if not sub:
        return None
    for key, value in update_data.items():
        setattr(sub, key, value)
    db.commit()
    db.refresh(sub)
    return sub


def create_subscription_change_log(
    db: Session,
    *,
    restaurant_id: int,
    subscription_id: int | None,
    actor_user_id: int | None,
    action: SubscriptionChangeAction,
    source: str,
    change_reason: str | None,
    previous_package_id: int | None,
    previous_package_name_snapshot: str | None,
    previous_package_code_snapshot: str | None,
    next_package_id: int | None,
    next_package_name_snapshot: str | None,
    next_package_code_snapshot: str | None,
    previous_status: SubscriptionStatus | None,
    next_status: SubscriptionStatus | None,
    previous_expires_at: datetime | None,
    next_expires_at: datetime | None,
    metadata: dict | None = None,
) -> SubscriptionChangeLog:
    log = SubscriptionChangeLog(
        restaurant_id=restaurant_id,
        subscription_id=subscription_id,
        actor_user_id=actor_user_id,
        action=action,
        source=source,
        change_reason=change_reason,
        previous_package_id=previous_package_id,
        previous_package_name_snapshot=previous_package_name_snapshot,
        previous_package_code_snapshot=previous_package_code_snapshot,
        next_package_id=next_package_id,
        next_package_name_snapshot=next_package_name_snapshot,
        next_package_code_snapshot=next_package_code_snapshot,
        previous_status=previous_status,
        next_status=next_status,
        previous_expires_at=previous_expires_at,
        next_expires_at=next_expires_at,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    db.add(log)
    db.flush()
    db.refresh(log)
    return log


def list_subscription_change_logs(
    db: Session,
    *,
    restaurant_id: int,
    limit: int = 100,
) -> list[SubscriptionChangeLog]:
    return (
        db.query(SubscriptionChangeLog)
        .filter(SubscriptionChangeLog.restaurant_id == restaurant_id)
        .order_by(SubscriptionChangeLog.created_at.desc(), SubscriptionChangeLog.id.desc())
        .limit(limit)
        .all()
    )
