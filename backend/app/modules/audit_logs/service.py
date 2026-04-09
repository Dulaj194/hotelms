from __future__ import annotations

import base64
import csv
import json
import uuid
import binascii
from io import StringIO
from pathlib import Path
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import and_, case, false, or_
from sqlalchemy.orm import Session, sessionmaker

from app.core.logging import get_logger
from app.db.session import SessionLocal
from app.modules.audit_logs import catalog
from app.modules.audit_logs.model import AuditLog, AuditLogExportJob, SuperAdminNotificationState
from app.modules.audit_logs.schemas import (
    AuditLogActorResponse,
    AuditLogEntryResponse,
    AuditLogExportJobResponse,
    AuditLogExportRequest,
    AuditLogListResponse,
    AuditLogRestaurantResponse,
    SuperAdminNotificationAssigneeListResponse,
    SuperAdminNotificationAssigneeResponse,
    SuperAdminNotificationBulkUpdateRequest,
    SuperAdminNotificationBulkUpdateResponse,
    SuperAdminNotificationBulkUpdateResultItem,
    SuperAdminNotificationListResponse,
    SuperAdminNotificationResponse,
    SuperAdminNotificationUpdateRequest,
)
from app.modules.platform_access import catalog as platform_access_catalog
from app.modules.users import repository as users_repository

logger = get_logger(__name__)

_EXPORT_JOB_STATUS_PENDING = "pending"
_EXPORT_JOB_STATUS_PROCESSING = "processing"
_EXPORT_JOB_STATUS_COMPLETED = "completed"
_EXPORT_JOB_STATUS_FAILED = "failed"
_AUDIT_EXPORT_TTL_HOURS = 24
_AUDIT_EXPORT_BATCH_SIZE = 500
_BACKEND_ROOT = Path(__file__).resolve().parents[3]
_AUDIT_EXPORT_DIR = _BACKEND_ROOT / "data" / "exports" / "audit-logs"
_AUDIT_EXPORT_DIR.mkdir(parents=True, exist_ok=True)


def _prepare_export_filters(filters: AuditLogExportRequest | dict[str, Any] | None) -> dict[str, Any]:
    if filters is None:
        return {}

    if isinstance(filters, AuditLogExportRequest):
        payload = filters.model_dump(exclude_none=True)
    else:
        payload = {k: v for k, v in dict(filters).items() if v is not None}

    normalized: dict[str, Any] = {}
    for key, value in payload.items():
        if isinstance(value, datetime):
            normalized[key] = value.isoformat()
        else:
            normalized[key] = value
    return normalized


def _parse_export_filter_datetimes(filters: dict[str, Any]) -> dict[str, Any]:
    parsed = dict(filters)
    for field_name in ("created_from", "created_to"):
        value = parsed.get(field_name)
        if isinstance(value, str):
            try:
                parsed[field_name] = datetime.fromisoformat(value)
            except ValueError:
                parsed[field_name] = None
    return parsed


def _build_export_file_path(job_id: str) -> Path:
    return _AUDIT_EXPORT_DIR / f"audit-logs-{job_id}.csv"


def _iter_audit_logs_for_export(
    base_query,
    *,
    batch_size: int = _AUDIT_EXPORT_BATCH_SIZE,
):
    cursor_created_at: datetime | None = None
    cursor_id: int | None = None

    while True:
        query = base_query
        if cursor_created_at is not None and cursor_id is not None:
            query = query.filter(
                or_(
                    AuditLog.created_at < cursor_created_at,
                    and_(AuditLog.created_at == cursor_created_at, AuditLog.id < cursor_id),
                )
            )

        rows = (
            query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .limit(batch_size)
            .all()
        )
        if not rows:
            break

        yield rows
        last = rows[-1]
        cursor_created_at = last.created_at
        cursor_id = last.id


def _write_audit_export_csv_file(
    db: Session,
    *,
    destination_path: Path,
    filters: dict[str, Any],
) -> int:
    export_filters = _parse_export_filter_datetimes(filters)
    base_query = _build_audit_logs_query(
        db,
        event_type=export_filters.get("event_type"),
        restaurant_id=export_filters.get("restaurant_id"),
        search=export_filters.get("search"),
        actor_search=export_filters.get("actor_search"),
        severity=export_filters.get("severity"),
        category=export_filters.get("category"),
        created_from=export_filters.get("created_from"),
        created_to=export_filters.get("created_to"),
    )

    row_count = 0
    with destination_path.open("w", encoding="utf-8", newline="") as export_file:
        writer = csv.writer(export_file)
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

        for batch in _iter_audit_logs_for_export(base_query):
            user_map, restaurant_map = _load_context_maps(db, batch)
            for log in batch:
                item = _serialize_audit_entry(
                    log=log,
                    user_map=user_map,
                    restaurant_map=restaurant_map,
                )
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
                row_count += 1

    return row_count


def create_audit_log_export_job(
    db: Session,
    *,
    requested_by_user_id: int | None,
    filters: AuditLogExportRequest,
) -> AuditLogExportJobResponse:
    job_id = uuid.uuid4().hex
    now = _utcnow()
    job = AuditLogExportJob(
        id=job_id,
        requested_by_user_id=requested_by_user_id,
        status=_EXPORT_JOB_STATUS_PENDING,
        filters_json=json.dumps(_prepare_export_filters(filters), ensure_ascii=True),
        expires_at=now + timedelta(hours=_AUDIT_EXPORT_TTL_HOURS),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return _serialize_export_job(job)


def process_audit_log_export_job(job_id: str) -> None:
    db = SessionLocal()
    try:
        job = (
            db.query(AuditLogExportJob)
            .filter(AuditLogExportJob.id == job_id)
            .first()
        )
        if job is None:
            return

        job.status = _EXPORT_JOB_STATUS_PROCESSING
        job.error_message = None
        db.add(job)
        db.commit()

        filters = _parse_metadata(job.filters_json)
        file_path = _build_export_file_path(job.id)
        row_count = _write_audit_export_csv_file(
            db,
            destination_path=file_path,
            filters=filters,
        )

        job.status = _EXPORT_JOB_STATUS_COMPLETED
        job.file_path = str(file_path)
        job.row_count = row_count
        job.completed_at = _utcnow()
        job.expires_at = _utcnow() + timedelta(hours=_AUDIT_EXPORT_TTL_HOURS)
        db.add(job)
        db.commit()
    except Exception as exc:  # pragma: no cover - background task failures are environment-specific
        logger.exception("Audit log export job failed: %s", job_id)
        failed_job = (
            db.query(AuditLogExportJob)
            .filter(AuditLogExportJob.id == job_id)
            .first()
        )
        if failed_job is not None:
            failed_job.status = _EXPORT_JOB_STATUS_FAILED
            failed_job.error_message = str(exc)[:2000]
            failed_job.completed_at = _utcnow()
            db.add(failed_job)
            db.commit()
    finally:
        db.close()


def get_audit_log_export_job(
    db: Session,
    *,
    job_id: str,
) -> AuditLogExportJobResponse:
    job = (
        db.query(AuditLogExportJob)
        .filter(AuditLogExportJob.id == job_id)
        .first()
    )
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export job not found.",
        )
    return _serialize_export_job(job)


def get_audit_log_export_download_path(
    db: Session,
    *,
    job_id: str,
) -> Path:
    job = (
        db.query(AuditLogExportJob)
        .filter(AuditLogExportJob.id == job_id)
        .first()
    )
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export job not found.",
        )
    if job.status != _EXPORT_JOB_STATUS_COMPLETED or not job.file_path:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Export job is not ready for download.",
        )

    file_path = Path(job.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export file no longer exists.",
        )
    return file_path


def export_audit_logs_csv(
    db: Session,
    *,
    event_type: str | None = None,
    restaurant_id: int | None = None,
    search: str | None = None,
    actor_search: str | None = None,
    severity: str | None = None,
    category: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
) -> str:
    filters = _prepare_export_filters(
        {
            "event_type": event_type,
            "restaurant_id": restaurant_id,
            "search": search,
            "actor_search": actor_search,
            "severity": severity,
            "category": category,
            "created_from": created_from,
            "created_to": created_to,
        }
    )
    buffer = StringIO()
    temp_path = _AUDIT_EXPORT_DIR / f"sync-export-{uuid.uuid4().hex}.csv"
    try:
        _write_audit_export_csv_file(db, destination_path=temp_path, filters=filters)
        buffer.write(temp_path.read_text(encoding="utf-8"))
        return buffer.getvalue()
    finally:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _encode_notification_cursor(
    created_at: datetime,
    audit_log_id: int,
    rank: int | None = None,
) -> str:
    if rank is None:
        payload = f"{created_at.isoformat()}|{audit_log_id}"
    else:
        payload = f"{created_at.isoformat()}|{audit_log_id}|{rank}"
    return base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii")


def _decode_notification_cursor(cursor: str) -> tuple[datetime, int, int | None]:
    try:
        decoded = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
        parts = decoded.split("|")
        if len(parts) not in {2, 3}:
            raise ValueError("Invalid cursor shape")

        raw_created_at, raw_id = parts[0], parts[1]
        created_at = datetime.fromisoformat(raw_created_at)
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=UTC)
        rank = int(parts[2]) if len(parts) == 3 else None
        return created_at, int(raw_id), rank
    except (ValueError, TypeError, binascii.Error):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid pagination cursor.",
        )


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


def _serialize_export_job(job: AuditLogExportJob) -> AuditLogExportJobResponse:
    return AuditLogExportJobResponse(
        id=job.id,
        status=job.status,
        row_count=job.row_count,
        error_message=job.error_message,
        created_at=job.created_at,
        updated_at=job.updated_at,
        completed_at=job.completed_at,
        expires_at=job.expires_at,
    )


def _build_audit_logs_query(
    db: Session,
    *,
    event_type: str | None = None,
    restaurant_id: int | None = None,
    search: str | None = None,
    actor_search: str | None = None,
    severity: str | None = None,
    category: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
):
    from app.modules.users.model import User

    query = db.query(AuditLog)

    if event_type:
        query = query.filter(AuditLog.event_type == event_type)

    if category:
        query = query.filter(AuditLog.category == category.strip().lower())

    if severity:
        query = query.filter(AuditLog.severity == severity.strip().lower())

    if restaurant_id is not None:
        query = query.filter(
            or_(
                AuditLog.restaurant_id == restaurant_id,
                AuditLog.metadata_restaurant_id == restaurant_id,
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

    return query


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
    if notification_state is not None and notification_state.archived_at is not None:
        return "archived"
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
            notification_state.archived_by_user_id,
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
    notification_state: SuperAdminNotificationState | None = None,
) -> AuditLogEntryResponse | SuperAdminNotificationResponse:
    """Serialize an audit log entry with optional notification fields.

    Args:
        log: The audit log entry
        user_map: Map of user_id → user object for fast lookup
        restaurant_map: Map of restaurant_id → restaurant object for fast lookup
        notification_state: Optional notification state. If provided, returns
                           SuperAdminNotificationResponse with notification fields.
                           Otherwise returns AuditLogEntryResponse.

    Returns:
        AuditLogEntryResponse if notification_state is None
        SuperAdminNotificationResponse if notification_state is provided
    """
    metadata = _parse_metadata(log.metadata_json)
    restaurant_id = _effective_restaurant_id(log, metadata)
    actor_obj = user_map.get(log.user_id) if log.user_id is not None else None
    restaurant_obj = restaurant_map.get(restaurant_id) if restaurant_id is not None else None

    restaurant_name = getattr(restaurant_obj, "name", None)
    
    # Base audit entry fields
    base_fields = dict(
        id=log.id,
        event_type=log.event_type,
        category=log.category or catalog.get_event_category(log.event_type),
        severity=log.severity or catalog.get_event_severity(log.event_type, metadata),
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

    # Return base response if no notification state
    if notification_state is None:
        return AuditLogEntryResponse(**base_fields)

    # Build notification-specific fields
    read_by = (
        user_map.get(notification_state.read_by_user_id)
        if notification_state.read_by_user_id is not None
        else None
    )
    assigned_to = (
        user_map.get(notification_state.assigned_user_id)
        if notification_state.assigned_user_id is not None
        else None
    )
    acknowledged_by = (
        user_map.get(notification_state.acknowledged_by_user_id)
        if notification_state.acknowledged_by_user_id is not None
        else None
    )
    archived_by = (
        user_map.get(notification_state.archived_by_user_id)
        if notification_state.archived_by_user_id is not None
        else None
    )

    return SuperAdminNotificationResponse(
        id=f"audit:{log.id}",
        audit_log_id=log.id,
        event_type=base_fields["event_type"],
        category=base_fields["category"],
        severity=base_fields["severity"],
        title=base_fields["title"],
        message=base_fields["message"],
        actor=base_fields["actor"],
        restaurant=base_fields["restaurant"],
        metadata=base_fields["metadata"],
        queue_status=_build_notification_queue_status(notification_state),
        is_read=bool(notification_state.is_read),
        read_at=notification_state.read_at,
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
        assigned_at=notification_state.assigned_at,
        is_acknowledged=bool(notification_state.acknowledged_at),
        acknowledged_at=notification_state.acknowledged_at,
        acknowledged_by=AuditLogActorResponse(
            user_id=getattr(acknowledged_by, "id", None),
            full_name=getattr(acknowledged_by, "full_name", None),
            email=getattr(acknowledged_by, "email", None),
        ),
        is_snoozed=_is_notification_snoozed(notification_state),
        snoozed_until=notification_state.snoozed_until,
        is_archived=bool(notification_state.archived_at),
        archived_at=notification_state.archived_at,
        archived_by=AuditLogActorResponse(
            user_id=getattr(archived_by, "id", None),
            full_name=getattr(archived_by, "full_name", None),
            email=getattr(archived_by, "email", None),
        ),
        created_at=log.created_at,
    )


def _serialize_notification_entry(
    *,
    log: AuditLog,
    notification_state: SuperAdminNotificationState | None,
    user_map: dict[int, object],
    restaurant_map: dict[int, object],
) -> SuperAdminNotificationResponse:
    """DEPRECATED: Use _serialize_audit_entry with notification_state parameter.

    This function is kept for backward compatibility.
    Calls _serialize_audit_entry with notification_state parameter.
    """
    return _serialize_audit_entry(
        log=log,
        user_map=user_map,
        restaurant_map=restaurant_map,
        notification_state=notification_state,
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
    user = users_repository.get_platform_user_for_super_admin(db, user_id)
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
        metadata_restaurant_id = _safe_int(metadata_payload.get("restaurant_id"))
        effective_restaurant_id = restaurant_id or metadata_restaurant_id
        category = catalog.get_event_category(event_type)
        severity = catalog.get_event_severity(event_type, metadata_payload)
        bind = db.get_bind()
        audit_session_factory = sessionmaker(bind=bind, autocommit=False, autoflush=False)
        with audit_session_factory() as audit_db:
            log = AuditLog(
                event_type=event_type,
                category=category,
                severity=severity,
                user_id=user_id,
                restaurant_id=effective_restaurant_id,
                metadata_restaurant_id=metadata_restaurant_id,
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
    category: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
) -> AuditLogListResponse:
    query = _build_audit_logs_query(
        db,
        event_type=event_type,
        restaurant_id=restaurant_id,
        search=search,
        actor_search=actor_search,
        severity=severity,
        category=category,
        created_from=created_from,
        created_to=created_to,
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
    cursor: str | None = None,
    queue_status: str | None = None,
    category: str | None = None,
    sort: str = "unresolved_first",
    include_archived: bool = False,
) -> SuperAdminNotificationListResponse:
    base_query = (
        db.query(AuditLog, SuperAdminNotificationState)
        .outerjoin(
            SuperAdminNotificationState,
            SuperAdminNotificationState.audit_log_id == AuditLog.id,
        )
        .filter(AuditLog.event_type.in_(sorted(catalog.HIGH_SIGNAL_EVENT_TYPES)))
    )

    if category:
        event_types = catalog.get_event_types_by_category(category)
        if not event_types:
            return SuperAdminNotificationListResponse(
                items=[],
                total=0,
                next_cursor=None,
                has_more=False,
            )
        base_query = base_query.filter(AuditLog.event_type.in_(sorted(event_types)))

    now = _utcnow()

    if queue_status:
        normalized_status = queue_status.strip().lower()
        if normalized_status == "archived":
            base_query = base_query.filter(SuperAdminNotificationState.archived_at.is_not(None))
        elif normalized_status == "acknowledged":
            base_query = base_query.filter(
                SuperAdminNotificationState.archived_at.is_(None),
                SuperAdminNotificationState.acknowledged_at.is_not(None),
            )
        elif normalized_status == "snoozed":
            base_query = base_query.filter(
                SuperAdminNotificationState.archived_at.is_(None),
                SuperAdminNotificationState.acknowledged_at.is_(None),
                SuperAdminNotificationState.snoozed_until.is_not(None),
                SuperAdminNotificationState.snoozed_until > now,
            )
        elif normalized_status == "assigned":
            base_query = base_query.filter(
                SuperAdminNotificationState.archived_at.is_(None),
                SuperAdminNotificationState.acknowledged_at.is_(None),
                SuperAdminNotificationState.assigned_user_id.is_not(None),
                or_(
                    SuperAdminNotificationState.snoozed_until.is_(None),
                    SuperAdminNotificationState.snoozed_until <= now,
                ),
            )
        elif normalized_status == "read":
            base_query = base_query.filter(
                SuperAdminNotificationState.archived_at.is_(None),
                SuperAdminNotificationState.acknowledged_at.is_(None),
                SuperAdminNotificationState.is_read.is_(True),
                SuperAdminNotificationState.assigned_user_id.is_(None),
                or_(
                    SuperAdminNotificationState.snoozed_until.is_(None),
                    SuperAdminNotificationState.snoozed_until <= now,
                ),
            )
        elif normalized_status == "unread":
            base_query = base_query.filter(
                SuperAdminNotificationState.archived_at.is_(None),
                SuperAdminNotificationState.acknowledged_at.is_(None),
                SuperAdminNotificationState.is_read.is_(False),
                SuperAdminNotificationState.assigned_user_id.is_(None),
                or_(
                    SuperAdminNotificationState.snoozed_until.is_(None),
                    SuperAdminNotificationState.snoozed_until <= now,
                ),
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid queue_status filter.",
            )
    elif not include_archived:
        base_query = base_query.filter(SuperAdminNotificationState.archived_at.is_(None))

    total = base_query.count()
    query = base_query

    cursor_created_at: datetime | None = None
    cursor_id: int | None = None
    cursor_rank: int | None = None
    if cursor:
        cursor_created_at, cursor_id, cursor_rank = _decode_notification_cursor(cursor)

    unresolved_rank_expr = case(
        (
            and_(
                SuperAdminNotificationState.archived_at.is_(None),
                SuperAdminNotificationState.acknowledged_at.is_(None),
            ),
            0,
        ),
        else_=1,
    )
    unread_rank_expr = case(
        (SuperAdminNotificationState.is_read.is_(False), 0),
        else_=1,
    )

    sort_mode = sort.strip().lower()
    if sort_mode not in {"newest_first", "oldest_first", "unread_first", "unresolved_first"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid sort option.",
        )

    if cursor_created_at is not None and cursor_id is not None:
        if sort_mode == "newest_first":
            query = query.filter(
                or_(
                    AuditLog.created_at < cursor_created_at,
                    and_(AuditLog.created_at == cursor_created_at, AuditLog.id < cursor_id),
                )
            )
        elif sort_mode == "oldest_first":
            query = query.filter(
                or_(
                    AuditLog.created_at > cursor_created_at,
                    and_(AuditLog.created_at == cursor_created_at, AuditLog.id > cursor_id),
                )
            )
        elif sort_mode == "unread_first":
            effective_rank = cursor_rank if cursor_rank is not None else 0
            query = query.filter(
                or_(
                    unread_rank_expr > effective_rank,
                    and_(
                        unread_rank_expr == effective_rank,
                        or_(
                            AuditLog.created_at > cursor_created_at,
                            and_(AuditLog.created_at == cursor_created_at, AuditLog.id > cursor_id),
                        ),
                    ),
                )
            )
        else:
            effective_rank = cursor_rank if cursor_rank is not None else 0
            query = query.filter(
                or_(
                    unresolved_rank_expr > effective_rank,
                    and_(
                        unresolved_rank_expr == effective_rank,
                        or_(
                            AuditLog.created_at > cursor_created_at,
                            and_(AuditLog.created_at == cursor_created_at, AuditLog.id > cursor_id),
                        ),
                    ),
                )
            )

    if sort_mode == "newest_first":
        query = query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    elif sort_mode == "oldest_first":
        query = query.order_by(AuditLog.created_at.asc(), AuditLog.id.asc())
    elif sort_mode == "unread_first":
        query = query.order_by(unread_rank_expr.asc(), AuditLog.created_at.asc(), AuditLog.id.asc())
    else:
        query = query.order_by(unresolved_rank_expr.asc(), AuditLog.created_at.asc(), AuditLog.id.asc())

    rows = query.limit(limit + 1).all()
    has_more = len(rows) > limit
    page_rows = rows[:limit]

    notification_state_map = {
        log.id: notification_state
        for log, notification_state in page_rows
        if notification_state is not None
    }
    logs = [log for log, _ in page_rows]
    user_map, restaurant_map = _load_context_maps(db, logs, notification_state_map)

    notifications = [
        _serialize_notification_entry(
            log=log,
            notification_state=notification_state,
            user_map=user_map,
            restaurant_map=restaurant_map,
        )
        for log, notification_state in page_rows
    ]

    next_cursor: str | None = None
    if has_more and page_rows:
        last_log, last_state = page_rows[-1]
        rank: int | None = None
        if sort_mode == "unread_first":
            rank = 0 if (last_state is not None and not last_state.is_read) else 1
        elif sort_mode == "unresolved_first":
            rank = (
                0
                if (
                    last_state is not None
                    and last_state.archived_at is None
                    and last_state.acknowledged_at is None
                )
                else 1
            )
        next_cursor = _encode_notification_cursor(last_log.created_at, last_log.id, rank)

    return SuperAdminNotificationListResponse(
        items=notifications,
        total=total,
        next_cursor=next_cursor,
        has_more=has_more,
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
        notification_state.archived_at is not None
        and "is_archived" not in provided_fields
        and any(
            field in provided_fields
            for field in ("is_read", "assigned_user_id", "is_acknowledged", "snoozed_until")
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unarchive this notification before updating queue state.",
        )

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

    if "is_archived" in provided_fields:
        if payload.is_archived:
            notification_state.archived_at = notification_state.archived_at or now
            notification_state.archived_by_user_id = (
                notification_state.archived_by_user_id or current_user_id
            )
            notification_state.is_read = True
            notification_state.read_at = notification_state.read_at or now
            notification_state.read_by_user_id = (
                notification_state.read_by_user_id or current_user_id
            )
        else:
            notification_state.archived_at = None
            notification_state.archived_by_user_id = None

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


def bulk_update_super_admin_notifications(
    db: Session,
    *,
    payload: SuperAdminNotificationBulkUpdateRequest,
    current_user: object,
) -> SuperAdminNotificationBulkUpdateResponse:
    unique_ids = list(dict.fromkeys(payload.notification_ids))
    action_payload: dict[str, Any] = {}
    if payload.assigned_user_id is not None:
        action_payload["assigned_user_id"] = payload.assigned_user_id
    if payload.is_read is not None:
        action_payload["is_read"] = payload.is_read
    if payload.is_acknowledged is not None:
        action_payload["is_acknowledged"] = payload.is_acknowledged
    if payload.is_archived is not None:
        action_payload["is_archived"] = payload.is_archived
    if payload.action_reason:
        action_payload["action_reason"] = payload.action_reason

    results: list[SuperAdminNotificationBulkUpdateResultItem] = []
    succeeded = 0

    for notification_id in unique_ids:
        try:
            update_super_admin_notification(
                db,
                notification_id,
                SuperAdminNotificationUpdateRequest(**action_payload),
                current_user,
            )
            results.append(
                SuperAdminNotificationBulkUpdateResultItem(
                    notification_id=notification_id,
                    status="ok",
                    message="Updated successfully.",
                )
            )
            succeeded += 1
        except HTTPException as exc:
            results.append(
                SuperAdminNotificationBulkUpdateResultItem(
                    notification_id=notification_id,
                    status="error",
                    message=str(exc.detail),
                )
            )

    failed = len(unique_ids) - succeeded
    return SuperAdminNotificationBulkUpdateResponse(
        total_requested=len(unique_ids),
        succeeded=succeeded,
        failed=failed,
        results=results,
    )
