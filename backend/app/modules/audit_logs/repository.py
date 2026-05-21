from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, or_, false
from app.modules.audit_logs.model import (
    AuditLog,
    AuditLogExportJob,
    SuperAdminNotificationState,
)
from app.modules.users.model import User
from app.modules.restaurants.model import Restaurant


def create_log(db: Session, log: AuditLog) -> AuditLog:
    """Create a new audit log entry."""
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_export_job_by_id(db: Session, job_id: str) -> AuditLogExportJob | None:
    """Get export job by ID."""
    return db.query(AuditLogExportJob).filter_by(id=job_id).first()


def create_export_job(db: Session, job: AuditLogExportJob) -> AuditLogExportJob:
    """Create new export job."""
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def update_export_job(db: Session, job: AuditLogExportJob) -> AuditLogExportJob:
    """Update export job."""
    db.merge(job)
    db.commit()
    return job


def list_export_jobs(
    db: Session,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[AuditLogExportJob], int]:
    """List export jobs with pagination."""
    query = db.query(AuditLogExportJob).order_by(desc(AuditLogExportJob.created_at))
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return items, total


def list_audit_logs(
    db: Session,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[AuditLog], int]:
    """List audit logs with pagination."""
    query = db.query(AuditLog).order_by(desc(AuditLog.created_at))
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return items, total


def get_users_by_ids(db: Session, user_ids: list[int]) -> dict[int, User]:
    """Get users by IDs as a dictionary for lookup."""
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    return {user.id: user for user in users}


def get_restaurants_by_ids(db: Session, restaurant_ids: list[int]) -> dict[int, Restaurant]:
    """Get restaurants by IDs as a dictionary for lookup."""
    restaurants = db.query(Restaurant).filter(Restaurant.id.in_(restaurant_ids)).all()
    return {restaurant.id: restaurant for restaurant in restaurants}


def get_notification_state(db: Session, audit_log_id: int) -> SuperAdminNotificationState | None:
    """Get super admin notification state for a specific audit log."""
    return (
        db.query(SuperAdminNotificationState)
        .filter(SuperAdminNotificationState.audit_log_id == audit_log_id)
        .first()
    )


def create_or_update_notification_state(
    db: Session,
    notification_state: SuperAdminNotificationState,
) -> SuperAdminNotificationState:
    """Create or update notification state (idempotent upsert)."""
    # Check if record exists by audit_log_id
    existing = (
        db.query(SuperAdminNotificationState)
        .filter(SuperAdminNotificationState.audit_log_id == notification_state.audit_log_id)
        .one_or_none()
    )
    
    if existing:
        # Update existing record
        # Guard: is_read is NOT NULL in the DB; fall back to False if the
        # in-memory object has not yet had its Python-side default applied.
        existing.is_read = notification_state.is_read if notification_state.is_read is not None else False
        existing.read_at = notification_state.read_at
        existing.read_by_user_id = notification_state.read_by_user_id
        existing.assigned_user_id = notification_state.assigned_user_id
        existing.assigned_at = notification_state.assigned_at
        existing.acknowledged_at = notification_state.acknowledged_at
        existing.acknowledged_by_user_id = notification_state.acknowledged_by_user_id
        existing.snoozed_until = notification_state.snoozed_until
        existing.archived_at = notification_state.archived_at
        existing.archived_by_user_id = notification_state.archived_by_user_id
        db.flush()
        db.refresh(existing)
        return existing
    
    # Create new record
    db.add(notification_state)
    db.flush()
    db.refresh(notification_state)
    return notification_state


def count_audit_logs_after_id(
    db: Session,
    since_id: int,
) -> int:
    """Count audit logs after a given ID."""
    return db.query(AuditLog).filter(AuditLog.id > since_id).count()


def get_user_ids_by_search_term(db: Session, pattern: str) -> list[int]:
    """Get user IDs matching a search pattern."""
    return [
        user_id for (user_id,) in db.query(User.id)
        .filter(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))
        .all()
    ]


def get_notification_states_by_audit_log_ids(
    db: Session, audit_log_ids: list[int]
) -> dict[int, SuperAdminNotificationState]:
    """Get super admin notification states for a list of audit log IDs."""
    if not audit_log_ids:
        return {}
    states = (
        db.query(SuperAdminNotificationState)
        .filter(SuperAdminNotificationState.audit_log_id.in_(audit_log_ids))
        .all()
    )
    return {state.audit_log_id: state for state in states}


def get_high_signal_audit_log(
    db: Session, audit_log_id: int, high_signal_types: list[str]
) -> AuditLog | None:
    """Get a high signal audit log by ID."""
    return (
        db.query(AuditLog)
        .filter(
            AuditLog.id == audit_log_id,
            AuditLog.event_type.in_(high_signal_types),
        )
        .first()
    )


def build_audit_logs_query_base(
    db: Session,
    *,
    event_type: str | None = None,
    restaurant_id: int | None = None,
    search: str | None = None,
    severity: str | None = None,
    category: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    actor_ids: list[int] | None = None,
):
    """Build the base query for audit logs filtering."""
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
    if actor_ids is not None:
        query = query.filter(AuditLog.user_id.in_(actor_ids) if actor_ids else false())

    if created_from is not None:
        query = query.filter(AuditLog.created_at >= created_from)
    if created_to is not None:
        query = query.filter(AuditLog.created_at <= created_to)

    return query


def write_audit_log_with_notification(
    audit_session_factory, 
    log: AuditLog, 
    is_high_signal: bool
) -> AuditLog:
    """Write an audit log entry in a dedicated session, optionally adding a notification state."""
    with audit_session_factory() as audit_db:
        audit_db.add(log)
        audit_db.flush()
        if is_high_signal:
            audit_db.add(SuperAdminNotificationState(audit_log_id=log.id))
        audit_db.commit()
        audit_db.refresh(log)
        audit_db.expunge(log)
        return log


def build_super_admin_notifications_query(
    db: Session,
    high_signal_types: list[str],
):
    """Build base query for super admin notifications joining audit logs."""
    return (
        db.query(AuditLog, SuperAdminNotificationState)
        .outerjoin(
            SuperAdminNotificationState,
            SuperAdminNotificationState.audit_log_id == AuditLog.id,
        )
        .filter(AuditLog.event_type.in_(high_signal_types))
    )

def update_notification_state(
    db: Session, notification_state: SuperAdminNotificationState
):
    """Update notification state with commit."""
    db.add(notification_state)
    db.commit()
    db.refresh(notification_state)
    return notification_state
