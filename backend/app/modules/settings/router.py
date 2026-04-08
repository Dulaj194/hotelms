from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_restaurant_id,
    get_db,
    require_platform_action,
    require_roles,
)
from app.modules.settings import service
from app.modules.settings.model import SettingsRequestStatus
from app.modules.settings.schemas import (
    SettingsRequestCreateRequest,
    SettingsRequestListResponse,
    SettingsRequestResponse,
    SettingsRequestReviewRequest,
    SettingsRequestReviewResponse,
)
from app.modules.users.model import User

router = APIRouter()


@router.post("/requests", response_model=SettingsRequestResponse, status_code=201)
def create_settings_request(
    payload: SettingsRequestCreateRequest,
    current_user: User = Depends(require_roles("owner", "admin")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> SettingsRequestResponse:
    return service.create_settings_request(
        db,
        restaurant_id=restaurant_id,
        requested_by=current_user.id,
        payload=payload,
    )


@router.get("/requests", response_model=SettingsRequestListResponse)
def list_my_settings_requests(
    limit: int = Query(default=100, ge=1, le=500),
    _current_user: User = Depends(require_roles("owner", "admin")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> SettingsRequestListResponse:
    return service.list_my_settings_requests(
        db,
        restaurant_id=restaurant_id,
        limit=limit,
    )


@router.get("/requests/pending", response_model=SettingsRequestListResponse)
def list_pending_requests_for_super_admin(
    limit: int = Query(default=100, ge=1, le=500),
    restaurant_id: int | None = Query(default=None, ge=1),
    _current_user: User = Depends(require_platform_action("settings_requests", "view")),
    db: Session = Depends(get_db),
) -> SettingsRequestListResponse:
    return service.list_pending_settings_requests(
        db,
        restaurant_id=restaurant_id,
        limit=limit,
    )


@router.get("/requests/history", response_model=SettingsRequestListResponse)
def list_reviewed_requests_for_super_admin(
    limit: int = Query(default=100, ge=1, le=500),
    restaurant_id: int | None = Query(default=None, ge=1),
    status_filter: str | None = Query(default=None),
    _current_user: User = Depends(require_platform_action("settings_requests", "view")),
    db: Session = Depends(get_db),
) -> SettingsRequestListResponse:
    try:
        request_status = SettingsRequestStatus(status_filter.upper()) if status_filter else None
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="status_filter must be APPROVED or REJECTED.",
        ) from exc
    if request_status == SettingsRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="History view only supports APPROVED or REJECTED statuses.",
        )
    return service.list_reviewed_settings_requests(
        db,
        restaurant_id=restaurant_id,
        status=request_status,
        limit=limit,
    )


@router.patch("/requests/{request_id}/review", response_model=SettingsRequestReviewResponse)
def review_settings_request(
    request_id: int,
    payload: SettingsRequestReviewRequest,
    current_user: User = Depends(require_platform_action("settings_requests", "approve")),
    db: Session = Depends(get_db),
) -> SettingsRequestReviewResponse:
    return service.review_settings_request(
        db,
        request_id=request_id,
        reviewer_user_id=current_user.id,
        payload=payload,
    )
