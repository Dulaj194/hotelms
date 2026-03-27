from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_restaurant_id, get_db, require_roles
from app.modules.settings import service
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
    _current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> SettingsRequestListResponse:
    return service.list_pending_settings_requests(
        db,
        restaurant_id=restaurant_id,
        limit=limit,
    )


@router.patch("/requests/{request_id}/review", response_model=SettingsRequestReviewResponse)
def review_settings_request(
    request_id: int,
    payload: SettingsRequestReviewRequest,
    current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> SettingsRequestReviewResponse:
    return service.review_settings_request(
        db,
        request_id=request_id,
        reviewer_user_id=current_user.id,
        payload=payload,
    )
