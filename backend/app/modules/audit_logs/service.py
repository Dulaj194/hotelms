from __future__ import annotations

import csv
import json
from io import StringIO
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import false, or_
from sqlalchemy.orm import Session, sessionmaker

from app.core.logging import get_logger
from app.modules.audit_logs import catalog
from app.modules.audit_logs.model import AuditLog, SuperAdminNotificationState
from app.modules.audit_logs.schemas import (
    AuditLogActorResponse,
    AuditLogEntryResponse,
    AuditLogListResponse,
    AuditLogRestaurantResponse,
    SuperAdminNotificationAssigneeListResponse,
    SuperAdminNotificationAssigneeResponse,
    SuperAdminNotificationListResponse,
    SuperAdminNotificationResponse,
    SuperAdminNotificationUpdateRequest,
)
from app.modules.platform_access import catalog as platform_access_catalog
from app.modules.users import repository as users_repository

logger = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _normalize_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _normalize_filter_datetime(value: datetime | None) -> datetime | None:
    normalized = _normalize_datetime(value)
    if normalized is None:
        return None
    return normalized.replace(tzinfo=None)


def _parse_metadata(metadata_json: str | None) -> dict[str, Any]:
    if not metadata_json:
        return {}
    try:
        value = json.loads(metadata_json)
    except Exception:
        return {}
    return value if isinstance(value, dict) else {}


def _safe_int(value: object) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _effective_restaurant_id(log: AuditLog, metadata: dict[str, Any]) -> int | None:
    return log.restaurant_id or _safe_int(metadata.get("restaurant_id"))


def _is_notification_snoozed(notification_state: SuperAdminNotificationState | None) -> bool:
    if notification_state is None or notification_state.snoozed_until is None:
        return False
    return bool(_normalize_datetime(notification_state.snoozed_until) > _utcnow())


def _build_notification_queue_status(
    notification_state: SuperAdminNotificationState | None,
) -> str:
    if notification_state is not None and notification_state.acknowledged_at is not None:
        return "acknowledged"
    if _is_notification_snoozed(notification_state):
        return "snoozed"
    if notification_state is not None and notification_state.assigned_user_id is not None:
        return "assigned"
    if notification_state is not None and notification_state.is_read:
        return "read"
    return "unread"


def _load_context_maps(
    db: Session,
    logs: list[AuditLog],
    notification_state_map: dict[int, SuperAdminNotificationState] | None = None,
) -> tuple[dict[int, object], dict[int, object]]:
    from app.modules.restaurants.model import Restaurant
    from app.modules.users.model import User

    user_ids = {log.user_id for log in logs if log.user_id is not None}
    restaurant_ids: set[int] = set()
    for log in logs:
        metadata = _parse_metadata(log.metadata_json)
        restaurant_id = _effective_restaurant_id(log, metadata)
        if restaurant_id is not None:
            restaurant_ids.add(restaurant_id)

    for notification_state in (notification_state_map or {}).values():
        for user_id in (
            notification_state.read_by_user_id,
            notification_state.assigned_user_id,
            notification_state.acknowledged_by_user_id,
        ):
            if user_id is not None:
                user_ids.add(user_id)

    user_map = {}
    if user_ids:
        user_map = {
            user.id: user
            for user in db.query(User).filter(User.id.in_(user_ids)).all()
        }

    restaurant_map = {}
    if restaurant_ids:
        restaurant_map = {
            restaurant.id: restaurant
            for restaurant in db.query(Restaurant).filter(Restaurant.id.in_(restaurant_ids)).all()
        }

    return user_map, restaurant_map


def _serialize_audit_entry(
    *,
    log: AuditLog,
    user_map: dict[int, object],
    restaurant_map: dict[int, object],
) -> AuditLogEntryResponse:
    metadata = _parse_metadata(log.metadata_json)
    restaurant_id = _effective_restaurant_id(log, metadata)
    actor_obj = user_map.get(log.user_id) if log.user_id is not None else None
    restaurant_obj = restaurant_map.get(restaurant_id) if restaurant_id is not None else None

    restaurant_name = getattr(restaurant_obj, "name", None)
    entry = AuditLogEntryResponse(
        id=log.id,
        event_type=log.event_type,
        category=catalog.get_event_category(log.event_type),
        severity=catalog.get_event_severity(log.event_type, metadata),
        title=catalog.get_event_title(log.event_type),
        message=catalog.build_event_message(
            event_type=log.event_type,
            metadata=metadata,
            restaurant_name=restaurant_name,
            restaurant_id=restaurant_id,
        ),
        ip_address=log.ip_address,
        user_agent=log.user_agent,
        actor=AuditLogActorResponse(
            user_id=log.user_id,
            full_name=getattr(actor_obj, "full_name", None),
            email=getattr(actor_obj, "email", None),
        ),
        restaurant=AuditLogRestaurantResponse(
            restaurant_id=restaurant_id,
            name=restaurant_name,
        ),
        metadata=metadata,
        created_at=log.created_at,
    )
    return entry


def _serialize_notification_entry(
    *,
    log: AuditLog,
    notification_state: SuperAdminNotificationState | None,
    user_map: dict[int, object],
    restaurant_map: dict[int, object],
) -> SuperAdminNotificationResponse:
    entry = _serialize_audit_entry(
        log=log,
        user_map=user_map,
        restaurant_map=restaurant_map,
    )

    read_by = (
        user_map.get(notification_state.read_by_user_id)
        if notification_state is not None and notification_state.read_by_user_id is not None
        else None
    )
    assigned_to = (
        user_map.get(notification_state.assigned_user_id)
        if notification_state is not None and notification_state.assigned_user_id is not None
        else None
    )
    acknowledged_by = (
        user_map.get(notification_state.acknowledged_by_user_id)
        if notification_state is not None and notification_state.acknowledged_by_user_id is not None
        else None
    )

    return SuperAdminNotificationResponse(
        id=f"audit:{entry.id}",
        audit_log_id=entry.id,
        event_type=entry.event_type,
        category=entry.category,
        severity=entry.severity,
        title=entry.title,
        message=entry.message,
        actor=entry.actor,
        restaurant=entry.restaurant,
        metadata=entry.metadata,
        queue_status=_build_notification_queue_status(notification_state),
        is_read=bool(notification_state.is_read) if notification_state is not None else False,
        read_at=notification_state.read_at if notification_state is not None else None,
        read_by=AuditLogActorResponse(
            user_id=getattr(read_by, "id", None),
            full_name=getattr(read_by, "full_name", None),
            email=getattr(read_by, "email", None),
        ),
        assigned_to=AuditLogActorResponse(
            user_id=getattr(assigned_to, "id", None),
            full_name=getattr(assigned_to, "full_name", None),
            email=getattr(assigned_to, "email", None),
        ),
        assigned_at=notification_state.assigned_at if notification_state is not None else None,
        is_acknowledged=bool(notification_state and notification_state.acknowledged_at),
        acknowledged_at=notification_state.acknowledged_at if notification_state is not None else None,
        acknowledged_by=AuditLogActorResponse(
            user_id=getattr(acknowledged_by, "id", None),
            full_name=getattr(acknowledged_by, "full_name", None),
            email=getattr(acknowledged_by, "email", None),
        ),
        is_snoozed=_is_notification_snoozed(notification_state),
        snoozed_until=notification_state.snoozed_until if notification_state is not None else None,
        created_at=entry.created_at,
    )


def _get_notification_state_map(
    db: Session,
    audit_log_ids: list[int],
) -> dict[int, SuperAdminNotificationState]:
    if not audit_log_ids:
        return {}
    states = (
        db.query(SuperAdminNotificationState)
        .filter(SuperAdminNotificationState.audit_log_id.in_(audit_log_ids))
        .all()
    )
    return {state.audit_log_id: state for state in states}


def _parse_notification_id(notification_id: str) -> int:
    prefix, separator, raw_audit_log_id = notification_id.partition(":")
    if prefix != "audit" or not separator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )

    audit_log_id = _safe_int(raw_audit_log_id)
    if audit_log_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )
    return audit_log_id


def _get_notification_target(
    db: Session,
    notification_id: str,
) -> tuple[AuditLog, SuperAdminNotificationState]:
    audit_log_id = _parse_notification_id(notification_id)
    log = (
        db.query(AuditLog)
        .filter(
            AuditLog.id == audit_log_id,
            AuditLog.event_type.in_(sorted(catalog.HIGH_SIGNAL_EVENT_TYPES)),
        )
        .first()
    )
    if log is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )

    notification_state = (
        db.query(SuperAdminNotificationState)
        .filter(SuperAdminNotificationState.audit_log_id == log.id)
        .first()
    )
    if notification_state is None:
        notification_state = SuperAdminNotificationState(audit_log_id=log.id)
        db.add(notification_state)
        db.commit()
        db.refresh(notification_state)

    return log, notification_state


def _get_valid_notification_assignee(db: Session, user_id: int):
    user = users_repository.get_platform_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Assignee must be an active platform user.",
        )
    if not platform_access_catalog.user_has_any_platform_scope(
        user,
        ("ops_viewer", "security_admin"),
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Assignee must have notification queue access.",
        )
    return user


def serialize_notification_entry(
    db: Session,
    log: AuditLog,
    notification_state: SuperAdminNotificationState | None = None,
) -> SuperAdminNotificationResponse:
    notification_state_map = (
        {notification_state.audit_log_id: notification_state}
        if notification_state is not None
        else _get_notification_state_map(db, [log.id])
    )
    user_map, restaurant_map = _load_context_maps(db, [log], notification_state_map)
    return _serialize_notification_entry(
        log=log,
        notification_state=notification_state_map.get(log.id),
        user_map=user_map,
        restaurant_map=restaurant_map,
    )


def write_audit_log(
    db: Session,
    event_type: str,
    user_id: int | None = None,
    restaurant_id: int | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    metadata: dict | None = None,
) -> AuditLog | None:
    """Write an audit log entry.

    Failures are caught and logged as warnings so that audit logging
    never interrupts the main application flow.
    """
    try:
        metadata_payload = dict(metadata or {})
        effective_restaurant_id = restaurant_id or _safe_int(
            metadata_payload.get("restaurant_id")
        )
        bind = db.get_bind()
        audit_session_factory = sessionmaker(bind=bind, autocommit=False, autoflush=False)
        with audit_session_factory() as audit_db:
            log = AuditLog(
                event_type=event_type,
                user_id=user_id,
                restaurant_id=effective_restaurant_id,
                ip_address=ip_address,
                user_agent=user_agent,
                metadata_json=json.dumps(metadata_payload) if metadata_payload else None,
            )
            audit_db.add(log)
            audit_db.flush()

            if event_type in catalog.HIGH_SIGNAL_EVENT_TYPES:
                audit_db.add(SuperAdminNotificationState(audit_log_id=log.id))

            audit_db.commit()
            audit_db.refresh(log)
            audit_db.expunge(log)
        return log
    except Exception as exc:
        logger.warning("Audit log write failed [%s]: %s", event_type, exc)
        return None


def list_audit_logs(
    db: Session,
    *,
    limit: int = 100,
    offset: int = 0,
    event_type: str | None = None,
    restaurant_id: int | None = None,
    search: str | None = None,
    actor_search: str | None = None,
    severity: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
) -> AuditLogListResponse:
    from app.modules.users.model import User

    query = db.query(AuditLog)

    if event_type:
        query = query.filter(AuditLog.event_type == event_type)

    if restaurant_id is not None:
        query = query.filter(
            or_(
                AuditLog.restaurant_id == restaurant_id,
                AuditLog.metadata_json.like(f'%\"restaurant_id\": {restaurant_id}%'),
                AuditLog.metadata_json.like(f'%\"restaurant_id\":{restaurant_id}%'),
            )
        )

    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                AuditLog.event_type.ilike(pattern),
                AuditLog.metadata_json.ilike(pattern),
                AuditLog.ip_address.ilike(pattern),
                AuditLog.user_agent.ilike(pattern),
            )
        )

    if actor_search:
        actor_pattern = f"%{actor_search.strip()}%"
        actor_ids = [
            user_id
            for (user_id,) in db.query(User.id)
            .filter(
                or_(
                    User.full_name.ilike(actor_pattern),
                    User.email.ilike(actor_pattern),
                )
            )
            .all()
        ]
        query = query.filter(AuditLog.user_id.in_(actor_ids) if actor_ids else false())

    normalized_created_from = _normalize_filter_datetime(created_from)
    if normalized_created_from is not None:
        query = query.filter(AuditLog.created_at >= normalized_created_from)

    normalized_created_to = _normalize_filter_datetime(created_to)
    if normalized_created_to is not None:
        query = query.filter(AuditLog.created_at <= normalized_created_to)

    ordered_items = query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).all()

    if severity:
        normalized_severity = severity.strip().lower()
        ordered_items = [
            log
            for log in ordered_items
            if catalog.get_event_severity(log.event_type, _parse_metadata(log.metadata_json))
            == normalized_severity
        ]

    total = len(ordered_items)
    items = ordered_items[offset: offset + limit]
    user_map, restaurant_map = _load_context_maps(db, items)

    return AuditLogListResponse(
        items=[
            _serialize_audit_entry(
                log=log,
                user_map=user_map,
                restaurant_map=restaurant_map,
            )
            for log in items
        ],
        total=total,
    )


def export_audit_logs_csv(
    db: Session,
    *,
    event_type: str | None = None,
    restaurant_id: int | None = None,
    search: str | None = None,
    actor_search: str | None = None,
    severity: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
) -> str:
    response = list_audit_logs(
        db,
        limit=5000,
        offset=0,
        event_type=event_type,
        restaurant_id=restaurant_id,
        search=search,
        actor_search=actor_search,
        severity=severity,
        created_from=created_from,
        created_to=created_to,
    )

    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "id",
            "created_at",
            "event_type",
            "category",
            "severity",
            "title",
            "message",
            "restaurant_id",
            "restaurant_name",
            "actor_user_id",
            "actor_name",
            "actor_email",
            "ip_address",
            "user_agent",
            "metadata_json",
        ]
    )

    for item in response.items:
        writer.writerow(
            [
                item.id,
                item.created_at.isoformat(),
                item.event_type,
                item.category,
                item.severity,
                item.title,
                item.message,
                item.restaurant.restaurant_id,
                item.restaurant.name,
                item.actor.user_id,
                item.actor.full_name,
                item.actor.email,
                item.ip_address,
                item.user_agent,
                json.dumps(item.metadata, ensure_ascii=True, sort_keys=True),
            ]
        )

    return buffer.getvalue()


def list_super_admin_notifications(
    db: Session,
    *,
    limit: int = 50,
) -> SuperAdminNotificationListResponse:
    query = (
        db.query(AuditLog, SuperAdminNotificationState)
        .outerjoin(
            SuperAdminNotificationState,
            SuperAdminNotificationState.audit_log_id == AuditLog.id,
        )
        .filter(AuditLog.event_type.in_(sorted(catalog.HIGH_SIGNAL_EVENT_TYPES)))
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    )
    rows = query.limit(limit).all()
    logs = [log for log, _notification_state in rows]
    notification_state_map = {
        log.id: notification_state
        for log, notification_state in rows
        if notification_state is not None
    }
    user_map, restaurant_map = _load_context_maps(db, logs, notification_state_map)

    notifications = [
        _serialize_notification_entry(
            log=log,
            notification_state=notification_state,
            user_map=user_map,
            restaurant_map=restaurant_map,
        )
        for log, notification_state in rows
    ]

    return SuperAdminNotificationListResponse(
        items=notifications,
        total=query.count(),
    )


def list_super_admin_notification_assignees(
    db: Session,
) -> SuperAdminNotificationAssigneeListResponse:
    users = [
        user
        for user in users_repository.list_platform_users(db, is_active=True)
        if platform_access_catalog.user_has_any_platform_scope(
            user,
            ("ops_viewer", "security_admin"),
        )
    ]
    items = [
        SuperAdminNotificationAssigneeResponse(
            user_id=user.id,
            full_name=user.full_name,
            email=user.email,
        )
        for user in sorted(users, key=lambda user: (user.full_name.lower(), user.id))
    ]
    return SuperAdminNotificationAssigneeListResponse(
        items=items,
        total=len(items),
    )


def update_super_admin_notification(
    db: Session,
    notification_id: str,
    payload: SuperAdminNotificationUpdateRequest,
    current_user: object,
) -> SuperAdminNotificationResponse:
    log, notification_state = _get_notification_target(db, notification_id)
    now = _utcnow()
    current_user_id = _safe_int(getattr(current_user, "id", None))
    provided_fields = payload.model_fields_set

    if (
        "is_read" in provided_fields
        and payload.is_read is False
        and notification_state.acknowledged_at is not None
        and (
            "is_acknowledged" not in provided_fields
            or payload.is_acknowledged is not False
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Clear acknowledgement before marking this notification as unread.",
        )

    if "assigned_user_id" in provided_fields:
        if payload.assigned_user_id is None:
            notification_state.assigned_user_id = None
            notification_state.assigned_at = None
        else:
            assignee = _get_valid_notification_assignee(db, payload.assigned_user_id)
            if notification_state.assigned_user_id != assignee.id or notification_state.assigned_at is None:
                notification_state.assigned_user_id = assignee.id
                notification_state.assigned_at = now

    if "is_read" in provided_fields:
        if payload.is_read:
            notification_state.is_read = True
            notification_state.read_at = notification_state.read_at or now
            notification_state.read_by_user_id = (
                notification_state.read_by_user_id or current_user_id
            )
        else:
            notification_state.is_read = False
            notification_state.read_at = None
            notification_state.read_by_user_id = None

    if "is_acknowledged" in provided_fields:
        if payload.is_acknowledged:
            notification_state.acknowledged_at = notification_state.acknowledged_at or now
            notification_state.acknowledged_by_user_id = (
                notification_state.acknowledged_by_user_id or current_user_id
            )
            notification_state.is_read = True
            notification_state.read_at = notification_state.read_at or now
            notification_state.read_by_user_id = (
                notification_state.read_by_user_id or current_user_id
            )
        else:
            notification_state.acknowledged_at = None
            notification_state.acknowledged_by_user_id = None

    if "snoozed_until" in provided_fields:
        if payload.snoozed_until is None:
            notification_state.snoozed_until = None
        else:
            snoozed_until = _normalize_datetime(payload.snoozed_until)
            if snoozed_until is None or snoozed_until <= now:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Snooze time must be in the future.",
                )
            notification_state.snoozed_until = snoozed_until
            notification_state.is_read = True
            notification_state.read_at = notification_state.read_at or now
            notification_state.read_by_user_id = (
                notification_state.read_by_user_id or current_user_id
            )

    db.add(notification_state)
    db.commit()
    db.refresh(notification_state)

    response = serialize_notification_entry(db, log, notification_state)

    try:
        from app.modules.realtime import service as realtime_service

        notification_payload = response.model_dump(mode="json")
        notification_payload["event"] = "notification:updated"
        realtime_service.publish_super_admin_notification(notification_payload)
    except Exception:
        pass

    return response
