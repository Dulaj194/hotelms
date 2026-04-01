from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_platform_scopes
from app.modules.audit_logs import service
from app.modules.audit_logs.schemas import (
    AuditLogListResponse,
    SuperAdminNotificationAssigneeListResponse,
    SuperAdminNotificationListResponse,
    SuperAdminNotificationResponse,
    SuperAdminNotificationUpdateRequest,
)

router = APIRouter()


@router.get("", response_model=AuditLogListResponse)
def list_audit_logs(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    event_type: str | None = Query(default=None),
    restaurant_id: int | None = Query(default=None, ge=1),
    search: str | None = Query(default=None, min_length=1, max_length=200),
    _current_user=Depends(require_platform_scopes("ops_viewer", "security_admin")),
    db: Session = Depends(get_db),
) -> AuditLogListResponse:
    return service.list_audit_logs(
        db,
        limit=limit,
        offset=offset,
        event_type=event_type,
        restaurant_id=restaurant_id,
        search=search,
    )


@router.get("/notifications", response_model=SuperAdminNotificationListResponse)
def list_super_admin_notifications(
    limit: int = Query(default=50, ge=1, le=200),
    _current_user=Depends(require_platform_scopes("ops_viewer", "security_admin")),
    db: Session = Depends(get_db),
) -> SuperAdminNotificationListResponse:
    return service.list_super_admin_notifications(db, limit=limit)


@router.get(
    "/notifications/assignees",
    response_model=SuperAdminNotificationAssigneeListResponse,
)
def list_super_admin_notification_assignees(
    _current_user=Depends(require_platform_scopes("ops_viewer", "security_admin")),
    db: Session = Depends(get_db),
) -> SuperAdminNotificationAssigneeListResponse:
    return service.list_super_admin_notification_assignees(db)


@router.patch(
    "/notifications/{notification_id}",
    response_model=SuperAdminNotificationResponse,
)
def update_super_admin_notification(
    notification_id: str,
    payload: SuperAdminNotificationUpdateRequest,
    current_user=Depends(require_platform_scopes("ops_viewer", "security_admin")),
    db: Session = Depends(get_db),
) -> SuperAdminNotificationResponse:
    return service.update_super_admin_notification(
        db,
        notification_id,
        payload,
        current_user,
    )
