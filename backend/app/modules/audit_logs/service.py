from __future__ import annotations

import json
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session, sessionmaker

from app.core.logging import get_logger
from app.modules.audit_logs import catalog
from app.modules.audit_logs.model import AuditLog
from app.modules.audit_logs.schemas import (
    AuditLogActorResponse,
    AuditLogEntryResponse,
    AuditLogListResponse,
    AuditLogRestaurantResponse,
    SuperAdminNotificationListResponse,
    SuperAdminNotificationResponse,
)

logger = get_logger(__name__)


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


def _load_context_maps(
    db: Session,
    logs: list[AuditLog],
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


def serialize_notification_entry(
    db: Session,
    log: AuditLog,
) -> SuperAdminNotificationResponse:
    user_map, restaurant_map = _load_context_maps(db, [log])
    entry = _serialize_audit_entry(
        log=log,
        user_map=user_map,
        restaurant_map=restaurant_map,
    )
    return SuperAdminNotificationResponse(
        id=f"audit:{entry.id}",
        event_type=entry.event_type,
        category=entry.category,
        severity=entry.severity,
        title=entry.title,
        message=entry.message,
        actor=entry.actor,
        restaurant=entry.restaurant,
        metadata=entry.metadata,
        created_at=entry.created_at,
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
        log = AuditLog(
            event_type=event_type,
            user_id=user_id,
            restaurant_id=effective_restaurant_id,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata_json=json.dumps(metadata_payload) if metadata_payload else None,
        )
        bind = db.get_bind()
        audit_session_factory = sessionmaker(bind=bind, autocommit=False, autoflush=False)
        with audit_session_factory() as audit_db:
            audit_db.add(log)
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
) -> AuditLogListResponse:
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

    total = query.count()
    items = (
        query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
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


def list_super_admin_notifications(
    db: Session,
    *,
    limit: int = 50,
) -> SuperAdminNotificationListResponse:
    query = (
        db.query(AuditLog)
        .filter(AuditLog.event_type.in_(sorted(catalog.HIGH_SIGNAL_EVENT_TYPES)))
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    )
    items = query.limit(limit).all()
    user_map, restaurant_map = _load_context_maps(db, items)

    notifications = []
    for log in items:
        entry = _serialize_audit_entry(
            log=log,
            user_map=user_map,
            restaurant_map=restaurant_map,
        )
        notifications.append(
            SuperAdminNotificationResponse(
                id=f"audit:{entry.id}",
                event_type=entry.event_type,
                category=entry.category,
                severity=entry.severity,
                title=entry.title,
                message=entry.message,
                actor=entry.actor,
                restaurant=entry.restaurant,
                metadata=entry.metadata,
                created_at=entry.created_at,
            )
        )

    return SuperAdminNotificationListResponse(
        items=notifications,
        total=len(notifications),
    )
