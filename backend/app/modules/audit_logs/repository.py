from sqlalchemy.orm import Session
from sqlalchemy import and_, desc

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


def get_notification_state(db: Session) -> SuperAdminNotificationState | None:
    """Get super admin notification state."""
    return db.query(SuperAdminNotificationState).first()


def create_or_update_notification_state(
    db: Session,
    notification_state: SuperAdminNotificationState,
) -> SuperAdminNotificationState:
    """Create or update notification state."""
    db.merge(notification_state)
    db.commit()
    return notification_state


def count_audit_logs_after_id(
    db: Session,
    since_id: int,
) -> int:
    """Count audit logs after a given ID."""
    return db.query(AuditLog).filter(AuditLog.id > since_id).count()

