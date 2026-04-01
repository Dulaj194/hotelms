from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.access import catalog as access_catalog
from app.modules.restaurants import repository as restaurant_repository
from app.modules.settings import repository
from app.modules.settings.model import SettingsRequestStatus
from app.modules.settings.schemas import (
    SettingsRequestCreateRequest,
    SettingsRequestListResponse,
    SettingsRequestResponse,
    SettingsRequestReviewRequest,
    SettingsRequestReviewResponse,
)

_PROFILE_SETTING_KEYS = {
    "name",
    "email",
    "phone",
    "address",
    "country",
    "currency",
    "billing_email",
    "opening_time",
    "closing_time",
    "logo_url",
}
_FEATURE_FLAG_KEYS = {
    definition.key for definition in access_catalog.list_feature_flag_definitions()
}
_ALLOWED_SETTING_KEYS = _PROFILE_SETTING_KEYS | _FEATURE_FLAG_KEYS


def _snapshot_current_settings(restaurant) -> dict[str, Any]:
    snapshot: dict[str, Any] = {}
    for key in sorted(_PROFILE_SETTING_KEYS):
        value = getattr(restaurant, key, None)
        if key == "billing_email" and not value:
            value = restaurant.email
        snapshot[key] = value
    snapshot.update(access_catalog.build_feature_flag_snapshot(restaurant))
    return snapshot


def _filter_requested_changes(
    *,
    current_settings: dict[str, Any],
    requested_changes: dict[str, Any],
) -> dict[str, Any]:
    unknown = sorted(set(requested_changes.keys()) - _ALLOWED_SETTING_KEYS)
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported setting key(s): {', '.join(unknown)}",
        )

    filtered: dict[str, Any] = {}
    for key, value in requested_changes.items():
        if current_settings.get(key) != value:
            filtered[key] = value
    return filtered


def create_settings_request(
    db: Session,
    *,
    restaurant_id: int,
    requested_by: int,
    payload: SettingsRequestCreateRequest,
) -> SettingsRequestResponse:
    restaurant = restaurant_repository.get_by_id(db, restaurant_id)
    if restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )

    if repository.has_pending_request_for_restaurant(db, restaurant_id=restaurant_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending settings request already exists for this restaurant.",
        )

    current_settings = _snapshot_current_settings(restaurant)
    filtered_changes = _filter_requested_changes(
        current_settings=current_settings,
        requested_changes=payload.requested_changes,
    )

    if not filtered_changes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No effective setting changes were requested.",
        )

    request = repository.create_request(
        db,
        restaurant_id=restaurant_id,
        requested_by=requested_by,
        requested_changes=filtered_changes,
        current_settings=current_settings,
        request_reason=payload.request_reason,
    )
    db.commit()
    db.refresh(request)
    return SettingsRequestResponse.model_validate(request)


def list_my_settings_requests(
    db: Session,
    *,
    restaurant_id: int,
    limit: int = 100,
) -> SettingsRequestListResponse:
    items = repository.list_requests_by_restaurant(
        db, restaurant_id=restaurant_id, limit=limit
    )
    return SettingsRequestListResponse(
        items=[SettingsRequestResponse.model_validate(item) for item in items],
        total=len(items),
    )


def list_pending_settings_requests(
    db: Session,
    *,
    restaurant_id: int | None,
    limit: int = 100,
) -> SettingsRequestListResponse:
    items = repository.list_pending_requests(
        db,
        restaurant_id=restaurant_id,
        limit=limit,
    )
    return SettingsRequestListResponse(
        items=[SettingsRequestResponse.model_validate(item) for item in items],
        total=len(items),
    )


def list_reviewed_settings_requests(
    db: Session,
    *,
    restaurant_id: int | None,
    status: SettingsRequestStatus | None,
    limit: int = 100,
) -> SettingsRequestListResponse:
    items = repository.list_reviewed_requests(
        db,
        restaurant_id=restaurant_id,
        status=status,
        limit=limit,
    )
    total = repository.count_reviewed_requests(
        db,
        restaurant_id=restaurant_id,
        status=status,
    )
    return SettingsRequestListResponse(
        items=[SettingsRequestResponse.model_validate(item) for item in items],
        total=total,
    )


def review_settings_request(
    db: Session,
    *,
    request_id: int,
    reviewer_user_id: int,
    payload: SettingsRequestReviewRequest,
) -> SettingsRequestReviewResponse:
    request = repository.get_request_by_id(db, request_id)
    if request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Settings request not found.",
        )

    if request.status != SettingsRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending settings requests can be reviewed.",
        )

    request.status = SettingsRequestStatus(payload.status)
    request.reviewed_by = reviewer_user_id
    request.review_notes = payload.review_notes
    request.reviewed_at = datetime.now(UTC)

    if request.status == SettingsRequestStatus.APPROVED:
        restaurant = restaurant_repository.get_by_id(db, request.restaurant_id)
        if restaurant is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Restaurant not found for this request.",
            )
        for key, value in request.requested_changes.items():
            if key in _PROFILE_SETTING_KEYS:
                if key == "billing_email" and not value:
                    value = restaurant.email
                setattr(restaurant, key, value)
                continue

            feature_flag = access_catalog.get_feature_flag_definition(key)
            if feature_flag is not None:
                setattr(restaurant, feature_flag.column_name, bool(value))

    db.commit()
    db.refresh(request)

    message = (
        "Settings request approved and changes applied."
        if request.status == SettingsRequestStatus.APPROVED
        else "Settings request rejected."
    )
    return SettingsRequestReviewResponse(
        message=message,
        request=SettingsRequestResponse.model_validate(request),
    )
