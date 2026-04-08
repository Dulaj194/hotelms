from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_platform_action
from app.modules.audit_logs import service
from app.modules.audit_logs.schemas import (
    AuditLogListResponse,
    AuditLogExportJobResponse,
    AuditLogExportRequest,
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
    actor_search: str | None = Query(default=None, min_length=1, max_length=200),
    severity: str | None = Query(default=None, pattern="^(info|success|warning|danger)$"),
    category: str | None = Query(default=None, min_length=1, max_length=80),
    created_from: datetime | None = Query(default=None),
    created_to: datetime | None = Query(default=None),
    _current_user=Depends(require_platform_action("audit_logs", "view")),
    db: Session = Depends(get_db),
) -> AuditLogListResponse:
    return service.list_audit_logs(
        db,
        limit=limit,
        offset=offset,
        event_type=event_type,
        restaurant_id=restaurant_id,
        search=search,
        actor_search=actor_search,
        severity=severity,
        category=category,
        created_from=created_from,
        created_to=created_to,
    )


@router.get("/export")
def export_audit_logs(
    event_type: str | None = Query(default=None),
    restaurant_id: int | None = Query(default=None, ge=1),
    search: str | None = Query(default=None, min_length=1, max_length=200),
    actor_search: str | None = Query(default=None, min_length=1, max_length=200),
    severity: str | None = Query(default=None, pattern="^(info|success|warning|danger)$"),
    category: str | None = Query(default=None, min_length=1, max_length=80),
    created_from: datetime | None = Query(default=None),
    created_to: datetime | None = Query(default=None),
    _current_user=Depends(require_platform_action("audit_logs", "view")),
    db: Session = Depends(get_db),
) -> Response:
    csv_content = service.export_audit_logs_csv(
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
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="audit-logs-export.csv"',
        },
    )


@router.post(
    "/export-jobs",
    response_model=AuditLogExportJobResponse,
    status_code=202,
)
def create_audit_log_export_job(
    payload: AuditLogExportRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(require_platform_action("audit_logs", "view")),
    db: Session = Depends(get_db),
) -> AuditLogExportJobResponse:
    job = service.create_audit_log_export_job(
        db,
        requested_by_user_id=getattr(current_user, "id", None),
        filters=payload,
    )
    background_tasks.add_task(service.process_audit_log_export_job, job.id)
    return job


@router.get(
    "/export-jobs/{job_id}",
    response_model=AuditLogExportJobResponse,
)
def get_audit_log_export_job(
    job_id: str,
    _current_user=Depends(require_platform_action("audit_logs", "view")),
    db: Session = Depends(get_db),
) -> AuditLogExportJobResponse:
    return service.get_audit_log_export_job(db, job_id=job_id)


@router.get("/export-jobs/{job_id}/download")
def download_audit_log_export_job(
    job_id: str,
    _current_user=Depends(require_platform_action("audit_logs", "view")),
    db: Session = Depends(get_db),
) -> FileResponse:
    file_path = service.get_audit_log_export_download_path(db, job_id=job_id)
    return FileResponse(
        path=str(file_path),
        media_type="text/csv",
        filename=f"audit-logs-export-{job_id}.csv",
    )


@router.get("/notifications", response_model=SuperAdminNotificationListResponse)
def list_super_admin_notifications(
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = Query(default=None),
    queue_status: str | None = Query(
        default=None,
        pattern="^(unread|read|assigned|snoozed|acknowledged|archived)$",
    ),
    category: str | None = Query(default=None),
    sort: str = Query(
        default="unresolved_first",
        pattern="^(newest_first|oldest_first|unread_first|unresolved_first)$",
    ),
    include_archived: bool = Query(default=False),
    _current_user=Depends(require_platform_action("notifications_queue", "view")),
    db: Session = Depends(get_db),
) -> SuperAdminNotificationListResponse:
    return service.list_super_admin_notifications(
        db,
        limit=limit,
        cursor=cursor,
        queue_status=queue_status,
        category=category,
        sort=sort,
        include_archived=include_archived,
    )


@router.get(
    "/notifications/assignees",
    response_model=SuperAdminNotificationAssigneeListResponse,
)
def list_super_admin_notification_assignees(
    _current_user=Depends(require_platform_action("notifications_queue", "view")),
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
    current_user=Depends(require_platform_action("notifications_queue", "mutate")),
    db: Session = Depends(get_db),
) -> SuperAdminNotificationResponse:
    return service.update_super_admin_notification(
        db,
        notification_id,
        payload,
        current_user,
    )
