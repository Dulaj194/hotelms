import json
from types import SimpleNamespace
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.access import catalog as access_catalog
from app.modules.audit_logs.service import write_audit_log
from app.modules.packages import catalog as packages_catalog
from app.modules.packages import repository as packages_repo
from app.modules.packages import service as packages_service
from app.modules.realtime import service as realtime_service
from app.modules.restaurants import repository as restaurants_repo
from app.modules.subscriptions import repository
from app.modules.subscriptions.model import (
    RestaurantSubscription,
    SubscriptionChangeAction,
    SubscriptionChangeLog,
    SubscriptionStatus,
)
from app.modules.subscriptions.schemas import (
    ActivateSubscriptionRequest,
    ActivateSubscriptionResponse,
    CancelSubscriptionResponse,
    StartTrialResponse,
    SubscriptionChangeActorResponse,
    SubscriptionChangeHistoryItemResponse,
    SubscriptionChangeHistoryResponse,
    SubscriptionAccessFeatureFlagResponse,
    SubscriptionAccessModuleResponse,
    SubscriptionAccessPrivilegeResponse,
    SubscriptionAccessSummaryResponse,
    SubscriptionPrivilegeResponse,
    SubscriptionResponse,
    SubscriptionStatusResponse,
)


# ============================================================================
# SUBSCRIPTION STATE TRANSITION HELPER
# ============================================================================
# Encapsulates the common pattern: clone state → modify → record change
class SubscriptionTransition:
    """Helper class for managing subscription state transitions.

    Consolidates the pattern used across activate, cancel, expire, and update
    functions to avoid duplication and ensure consistent audit logging.

    Usage:
        transition = SubscriptionTransition(db, restaurant_id)
        previous = transition.get_previous_state()
        next_sub = transition.perform_update(
            handler=lambda: repository.create_subscription(...),
            action=SubscriptionChangeAction.activated,
            audit_event_type="subscription_activated",
        )
    """

    def __init__(
        self,
        db: Session,
        restaurant_id: int,
        actor_user_id: int | None = None,
        source: str = "system",
    ):
        self.db = db
        self.restaurant_id = restaurant_id
        self.actor_user_id = actor_user_id
        self.source = source
        self._previous_state: RestaurantSubscription | None = None

    def get_previous_state(self) -> RestaurantSubscription | None:
        """Get and cache the previous subscription state."""
        if self._previous_state is None:
            latest = repository.get_latest_subscription_by_restaurant(
                self.db, self.restaurant_id
            )
            self._previous_state = _clone_subscription_state(latest)
        return self._previous_state

    def perform_update(
        self,
        *,
        handler: callable,  # Callable that performs the modification and returns new subscription
        action: SubscriptionChangeAction,
        audit_event_type: str,
        change_reason: str | None = None,
        emit_live_notification: bool = True,
        extra_metadata: dict | None = None,
    ) -> RestaurantSubscription:
        """Execute transition: call handler, then record the change.

        Args:
            handler: Function that performs the database modification
                     and returns the updated subscription
            action: The type of change action
            audit_event_type: The audit log event type
            change_reason: Optional description of why the change occurred
            emit_live_notification: Whether to publish realtime notification
            extra_metadata: Additional metadata to include in audit log

        Returns:
            The updated subscription object
        """
        previous = self.get_previous_state()
        next_subscription = handler()

        _record_subscription_change(
            self.db,
            action=action,
            restaurant_id=self.restaurant_id,
            previous_subscription=previous,
            next_subscription=next_subscription,
            actor_user_id=self.actor_user_id,
            source=self.source,
            change_reason=change_reason,
            audit_event_type=audit_event_type,
            emit_live_notification=emit_live_notification,
            extra_metadata=extra_metadata,
        )
        return next_subscription


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


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


def _parse_metadata_json(value: str | None) -> dict:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _clone_subscription_state(
    subscription: RestaurantSubscription | None,
):
    if subscription is None:
        return None

    package = getattr(subscription, "package", None)
    package_snapshot = (
        SimpleNamespace(
            name=getattr(package, "name", None),
            code=getattr(package, "code", None),
        )
        if package is not None
        else None
    )
    return SimpleNamespace(
        id=subscription.id,
        restaurant_id=subscription.restaurant_id,
        package_id=subscription.package_id,
        package=package_snapshot,
        status=subscription.status,
        expires_at=subscription.expires_at,
        trial_expires_at=subscription.trial_expires_at,
        is_trial=subscription.is_trial,
    )


def _build_subscription_audit_metadata(
    *,
    restaurant_id: int,
    previous_subscription: RestaurantSubscription | None,
    next_subscription: RestaurantSubscription | None,
    change_reason: str | None,
    source: str,
    extra_metadata: dict | None = None,
) -> dict:
    metadata = {
        "restaurant_id": restaurant_id,
        "source": source,
        "change_reason": change_reason,
        "previous_package_id": previous_subscription.package_id if previous_subscription else None,
        "previous_package_name": previous_subscription.package.name
        if previous_subscription and previous_subscription.package
        else None,
        "previous_package_code": previous_subscription.package.code
        if previous_subscription and previous_subscription.package
        else None,
        "next_package_id": next_subscription.package_id if next_subscription else None,
        "next_package_name": next_subscription.package.name
        if next_subscription and next_subscription.package
        else None,
        "next_package_code": next_subscription.package.code
        if next_subscription and next_subscription.package
        else None,
        "previous_status": _effective_status(previous_subscription)
        if previous_subscription
        else None,
        "next_status": _effective_status(next_subscription)
        if next_subscription
        else None,
        "previous_expires_at": previous_subscription.expires_at.isoformat()
        if previous_subscription and previous_subscription.expires_at
        else None,
        "next_expires_at": next_subscription.expires_at.isoformat()
        if next_subscription and next_subscription.expires_at
        else None,
    }
    if extra_metadata:
        metadata.update(extra_metadata)
    return metadata


def _record_subscription_change(
    db: Session,
    *,
    action: SubscriptionChangeAction,
    restaurant_id: int,
    previous_subscription: RestaurantSubscription | None,
    next_subscription: RestaurantSubscription | None,
    actor_user_id: int | None,
    source: str,
    change_reason: str | None,
    audit_event_type: str,
    emit_live_notification: bool = True,
    extra_metadata: dict | None = None,
) -> None:
    metadata = _build_subscription_audit_metadata(
        restaurant_id=restaurant_id,
        previous_subscription=previous_subscription,
        next_subscription=next_subscription,
        change_reason=change_reason,
        source=source,
        extra_metadata=extra_metadata,
    )
    repository.create_subscription_change_log(
        db,
        restaurant_id=restaurant_id,
        subscription_id=next_subscription.id if next_subscription else previous_subscription.id if previous_subscription else None,
        actor_user_id=actor_user_id,
        action=action,
        source=source,
        change_reason=change_reason,
        previous_package_id=previous_subscription.package_id if previous_subscription else None,
        previous_package_name_snapshot=previous_subscription.package.name
        if previous_subscription and previous_subscription.package
        else None,
        previous_package_code_snapshot=previous_subscription.package.code
        if previous_subscription and previous_subscription.package
        else None,
        next_package_id=next_subscription.package_id if next_subscription else None,
        next_package_name_snapshot=next_subscription.package.name
        if next_subscription and next_subscription.package
        else None,
        next_package_code_snapshot=next_subscription.package.code
        if next_subscription and next_subscription.package
        else None,
        previous_status=previous_subscription.status if previous_subscription else None,
        next_status=next_subscription.status if next_subscription else None,
        previous_expires_at=previous_subscription.expires_at if previous_subscription else None,
        next_expires_at=next_subscription.expires_at if next_subscription else None,
        metadata=metadata,
    )
    audit_log = write_audit_log(
        db,
        event_type=audit_event_type,
        user_id=actor_user_id,
        restaurant_id=restaurant_id,
        metadata=metadata,
    )
    if emit_live_notification and audit_log is not None:
        realtime_service.publish_super_admin_audit_notification(
            audit_log=audit_log,
            restaurant_id=restaurant_id,
        )


def _resolve_package_snapshot_fields(
    item: SubscriptionChangeLog,
    package_map: dict[int, object],
    *,
    direction: str,
) -> tuple[str | None, str | None]:
    metadata = _parse_metadata_json(item.metadata_json)

    if direction == "previous":
        package_id = item.previous_package_id
        package_name = item.previous_package_name_snapshot or metadata.get("previous_package_name")
        package_code = item.previous_package_code_snapshot or metadata.get("previous_package_code")
    else:
        package_id = item.next_package_id
        package_name = (
            item.next_package_name_snapshot
            or metadata.get("next_package_name")
            or metadata.get("package_name")
        )
        package_code = item.next_package_code_snapshot or metadata.get("next_package_code")

    package = package_map.get(package_id) if package_id is not None else None
    resolved_name = package_name or getattr(package, "name", None)
    resolved_code = package_code or getattr(package, "code", None)
    return resolved_name, resolved_code


def _serialize_subscription_change_history(
    db: Session,
    items: list[SubscriptionChangeLog],
) -> SubscriptionChangeHistoryResponse:
    from app.modules.packages.model import Package
    from app.modules.users.model import User

    user_ids = {item.actor_user_id for item in items if item.actor_user_id is not None}
    package_ids = {
        package_id
        for item in items
        for package_id in (item.previous_package_id, item.next_package_id)
        if package_id is not None
    }

    user_map = {}
    if user_ids:
        user_map = {
            user.id: user
            for user in db.query(User).filter(User.id.in_(user_ids)).all()
        }

    package_map = {}
    if package_ids:
        package_map = {
            package.id: package
            for package in db.query(Package).filter(Package.id.in_(package_ids)).all()
        }

    history_items: list[SubscriptionChangeHistoryItemResponse] = []
    for item in items:
        previous_snapshot = _resolve_package_snapshot_fields(
            item,
            package_map,
            direction="previous",
        )
        next_snapshot = _resolve_package_snapshot_fields(
            item,
            package_map,
            direction="next",
        )
        history_items.append(
            SubscriptionChangeHistoryItemResponse(
                id=item.id,
                restaurant_id=item.restaurant_id,
                subscription_id=item.subscription_id,
                action=item.action.value,
                source=item.source,
                change_reason=item.change_reason,
                previous_package_id=item.previous_package_id,
                previous_package_name=previous_snapshot[0],
                previous_package_code=previous_snapshot[1],
                next_package_id=item.next_package_id,
                next_package_name=next_snapshot[0],
                next_package_code=next_snapshot[1],
                previous_status=item.previous_status.value if item.previous_status else None,
                next_status=item.next_status.value if item.next_status else None,
                previous_expires_at=item.previous_expires_at,
                next_expires_at=item.next_expires_at,
                actor=SubscriptionChangeActorResponse(
                    user_id=item.actor_user_id,
                    full_name=user_map[item.actor_user_id].full_name
                    if item.actor_user_id in user_map
                    else None,
                    email=user_map[item.actor_user_id].email
                    if item.actor_user_id in user_map
                    else None,
                ),
                metadata=_parse_metadata_json(item.metadata_json),
                created_at=item.created_at,
            )
        )

    return SubscriptionChangeHistoryResponse(
        items=history_items,
        total=len(history_items),
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
    actor_user_id: int | None = None,
    change_reason: str | None = None,
    source: str = "system",
    emit_live_notification: bool = True,
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
    _record_subscription_change(
        db,
        action=SubscriptionChangeAction.trial_assigned,
        restaurant_id=restaurant_id,
        previous_subscription=None,
        next_subscription=subscription,
        actor_user_id=actor_user_id,
        source=source,
        change_reason=change_reason,
        audit_event_type="subscription_trial_assigned",
        emit_live_notification=emit_live_notification,
        extra_metadata={"package_name": trial_package.name},
    )
    if commit:
        db.commit()


def start_trial(
    db: Session,
    restaurant_id: int,
    *,
    actor_user_id: int | None = None,
    change_reason: str | None = None,
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

    previous_subscription = _clone_subscription_state(
        repository.get_latest_subscription_by_restaurant(db, restaurant_id)
    )
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
    _record_subscription_change(
        db,
        action=SubscriptionChangeAction.trial_assigned,
        restaurant_id=restaurant_id,
        previous_subscription=previous_subscription,
        next_subscription=subscription,
        actor_user_id=actor_user_id,
        source="tenant",
        change_reason=change_reason,
        audit_event_type="subscription_trial_assigned",
        extra_metadata={"package_name": trial_package.name},
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
    *,
    actor_user_id: int | None = None,
    change_reason: str | None = None,
) -> ActivateSubscriptionResponse:
    packages_service.ensure_default_packages(db)
    package = _get_active_package_by_selector(db, payload)

    subscription = activate_paid_subscription(
        db,
        restaurant_id=restaurant_id,
        package_id=package.id,
        actor_user_id=actor_user_id,
        change_reason=change_reason,
        source="tenant",
    )
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
    actor_user_id: int | None = None,
    change_reason: str | None = None,
    source: str = "system",
    emit_live_notification: bool = True,
) -> RestaurantSubscription:
    package = packages_repo.get_package_by_id(db, package_id)
    if package is None or not package.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found or inactive.",
        )

    now = _utcnow_naive()
    expires_at = now + timedelta(days=package.billing_period_days)
    previous_subscription = _clone_subscription_state(
        repository.get_latest_subscription_by_restaurant(db, restaurant_id)
    )

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
    _record_subscription_change(
        db,
        action=SubscriptionChangeAction.activated,
        restaurant_id=restaurant_id,
        previous_subscription=previous_subscription,
        next_subscription=subscription,
        actor_user_id=actor_user_id,
        source=source,
        change_reason=change_reason,
        audit_event_type="subscription_activated",
        emit_live_notification=emit_live_notification,
        extra_metadata={"package_name": package.name},
    )
    return subscription


def cancel_subscription(
    db: Session,
    restaurant_id: int,
    *,
    actor_user_id: int | None = None,
    change_reason: str | None = None,
) -> CancelSubscriptionResponse:
    current_open = repository.get_current_open_subscription_by_restaurant(db, restaurant_id)
    if current_open is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active subscription to cancel.",
        )

    now = _utcnow_naive()
    previous_snapshot = _clone_subscription_state(
        repository.get_latest_subscription_by_restaurant(db, restaurant_id)
    )
    current_open.status = SubscriptionStatus.cancelled
    current_open.expires_at = now
    _record_subscription_change(
        db,
        action=SubscriptionChangeAction.cancelled,
        restaurant_id=restaurant_id,
        previous_subscription=previous_snapshot,
        next_subscription=current_open,
        actor_user_id=actor_user_id,
        source="tenant",
        change_reason=change_reason,
        audit_event_type="subscription_cancelled",
    )
    db.commit()

    return CancelSubscriptionResponse(
        message="Subscription cancelled successfully.",
        status="cancelled",
    )


# ─── Super-admin operations ───────────────────────────────────────────────────


def expire_overdue_subscriptions(
    db: Session,
    *,
    actor_user_id: int | None = None,
    source: str = "system",
    emit_live_notification: bool = True,
) -> int:
    """Persist expired status for all active/trial subscriptions past their expiry.

    Called by the background worker and the manual super_admin trigger endpoint.
    Returns the number of subscriptions that were updated.
    """
    overdue = repository.get_overdue_open_subscriptions(db)
    for sub in overdue:
        previous_snapshot = _clone_subscription_state(
            repository.get_latest_subscription_by_restaurant(
                db,
                sub.restaurant_id,
            )
        )
        sub.status = SubscriptionStatus.expired
        _record_subscription_change(
            db,
            action=SubscriptionChangeAction.expired,
            restaurant_id=sub.restaurant_id,
            previous_subscription=previous_snapshot,
            next_subscription=sub,
            actor_user_id=actor_user_id,
            source=source,
            change_reason="Subscription expired after the billing window elapsed.",
            audit_event_type="subscription_expired",
            emit_live_notification=emit_live_notification,
        )
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


def get_subscription_change_history_for_super_admin(
    db: Session,
    restaurant_id: int,
    *,
    limit: int = 100,
) -> SubscriptionChangeHistoryResponse:
    restaurant = restaurants_repo.get_by_id_for_super_admin(db, restaurant_id)
    if restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    items = repository.list_subscription_change_logs(
        db,
        restaurant_id=restaurant_id,
        limit=limit,
    )
    return _serialize_subscription_change_history(db, items)


def update_subscription_for_super_admin(
    db: Session,
    restaurant_id: int,
    payload: "SuperAdminSubscriptionUpdateRequest",
    *,
    actor_user_id: int | None = None,
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
    previous_snapshot = _clone_subscription_state(
        repository.get_latest_subscription_by_restaurant(db, restaurant_id)
    )

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
    _record_subscription_change(
        db,
        action=SubscriptionChangeAction.updated,
        restaurant_id=restaurant_id,
        previous_subscription=previous_snapshot,
        next_subscription=updated,
        actor_user_id=actor_user_id,
        source="super_admin",
        change_reason=payload.change_reason,
        audit_event_type="subscription_updated",
    )
    db.commit()
    db.refresh(updated)
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
