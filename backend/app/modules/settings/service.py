from __future__ import annotations

import base64
import binascii
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.access import catalog as access_catalog
from app.modules.audit_logs.service import write_audit_log
from app.modules.realtime import service as realtime_service
from app.modules.restaurants import repository as restaurant_repository
from app.modules.settings import repository
from app.modules.settings.model import SettingsRequestStatus
from app.modules.settings.schemas import (
    SettingsRequestBulkReviewRequest,
    SettingsRequestBulkReviewResponse,
    SettingsRequestBulkReviewResultItem,
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


def _encode_pagination_cursor(timestamp: datetime, request_id: int) -> str:
    payload = f"{timestamp.isoformat()}|{request_id}"
    return base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii")


def _decode_pagination_cursor(cursor: str) -> tuple[datetime, int]:
    try:
        decoded = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
        raw_timestamp, raw_request_id = decoded.split("|", 1)
        timestamp = datetime.fromisoformat(raw_timestamp)
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=UTC)
        return timestamp, int(raw_request_id)
    except (ValueError, TypeError, binascii.Error):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid pagination cursor.",
        )


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
    audit_log = write_audit_log(
        db,
        event_type="settings_request_submitted",
        user_id=requested_by,
        restaurant_id=restaurant_id,
        metadata={
            "restaurant_id": restaurant_id,
            "request_id": request.request_id,
            "requested_change_count": len(filtered_changes),
            "requested_changes": filtered_changes,
            "request_reason": payload.request_reason,
        },
    )
    if audit_log is not None:
        realtime_service.publish_super_admin_audit_notification(
            audit_log=audit_log,
            restaurant_id=restaurant_id,
        )
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
        next_cursor=None,
        has_more=False,
    )


def list_pending_settings_requests(
    db: Session,
    *,
    restaurant_id: int | None,
    limit: int = 100,
    cursor: str | None = None,
    sort_order: str = "oldest",
) -> SettingsRequestListResponse:
    cursor_created_at: datetime | None = None
    cursor_request_id: int | None = None
    if cursor:
        cursor_created_at, cursor_request_id = _decode_pagination_cursor(cursor)

    items = repository.list_pending_requests(
        db,
        restaurant_id=restaurant_id,
        limit=limit + 1,
        cursor_created_at=cursor_created_at,
        cursor_request_id=cursor_request_id,
        sort_order=sort_order,
    )
    has_more = len(items) > limit
    current_page = items[:limit]
    total = repository.count_pending_requests(
        db,
        restaurant_id=restaurant_id,
    )

    next_cursor: str | None = None
    if has_more and current_page:
        last = current_page[-1]
        next_cursor = _encode_pagination_cursor(last.created_at, last.request_id)

    return SettingsRequestListResponse(
        items=[SettingsRequestResponse.model_validate(item) for item in current_page],
        total=total,
        next_cursor=next_cursor,
        has_more=has_more,
    )


def get_pending_settings_requests_count(
    db: Session,
    *,
    restaurant_id: int | None = None,
) -> int:
    return repository.count_pending_requests(
        db,
        restaurant_id=restaurant_id,
    )


def list_reviewed_settings_requests(
    db: Session,
    *,
    restaurant_id: int | None,
    status: SettingsRequestStatus | None,
    limit: int = 100,
    cursor: str | None = None,
    sort_order: str = "newest",
) -> SettingsRequestListResponse:
    cursor_reviewed_at: datetime | None = None
    cursor_request_id: int | None = None
    if cursor:
        cursor_reviewed_at, cursor_request_id = _decode_pagination_cursor(cursor)

    items = repository.list_reviewed_requests(
        db,
        restaurant_id=restaurant_id,
        status=status,
        limit=limit + 1,
        cursor_reviewed_at=cursor_reviewed_at,
        cursor_request_id=cursor_request_id,
        sort_order=sort_order,
    )
    has_more = len(items) > limit
    current_page = items[:limit]

    next_cursor: str | None = None
    if has_more and current_page:
        last = current_page[-1]
        review_marker = last.reviewed_at or last.updated_at
        next_cursor = _encode_pagination_cursor(review_marker, last.request_id)

    total = repository.count_reviewed_requests(
        db,
        restaurant_id=restaurant_id,
        status=status,
    )
    return SettingsRequestListResponse(
        items=[SettingsRequestResponse.model_validate(item) for item in current_page],
        total=total,
        next_cursor=next_cursor,
        has_more=has_more,
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

    audit_event_type = (
        "settings_request_approved"
        if request.status == SettingsRequestStatus.APPROVED
        else "settings_request_rejected"
    )
    audit_log = write_audit_log(
        db,
        event_type=audit_event_type,
        user_id=reviewer_user_id,
        restaurant_id=request.restaurant_id,
        metadata={
            "restaurant_id": request.restaurant_id,
            "request_id": request.request_id,
            "requested_change_count": len(request.requested_changes),
            "review_notes": payload.review_notes,
        },
    )
    if audit_log is not None:
        realtime_service.publish_super_admin_audit_notification(
            audit_log=audit_log,
            restaurant_id=request.restaurant_id,
        )

    message = (
        "Settings request approved and changes applied."
        if request.status == SettingsRequestStatus.APPROVED
        else "Settings request rejected."
    )
    return SettingsRequestReviewResponse(
        message=message,
        request=SettingsRequestResponse.model_validate(request),
    )


def bulk_review_settings_requests(
    db: Session,
    *,
    reviewer_user_id: int,
    payload: SettingsRequestBulkReviewRequest,
) -> SettingsRequestBulkReviewResponse:
    unique_ids = list(dict.fromkeys(payload.request_ids))
    results: list[SettingsRequestBulkReviewResultItem] = []
    succeeded = 0

    for request_id in unique_ids:
        try:
            review_settings_request(
                db,
                request_id=request_id,
                reviewer_user_id=reviewer_user_id,
                payload=SettingsRequestReviewRequest(
                    status=payload.status,
                    review_notes=payload.review_notes,
                ),
            )
            results.append(
                SettingsRequestBulkReviewResultItem(
                    request_id=request_id,
                    status="ok",
                    message="Reviewed successfully.",
                )
            )
            succeeded += 1
        except HTTPException as exc:
            results.append(
                SettingsRequestBulkReviewResultItem(
                    request_id=request_id,
                    status="error",
                    message=str(exc.detail),
                )
            )

    failed = len(unique_ids) - succeeded
    return SettingsRequestBulkReviewResponse(
        total_requested=len(unique_ids),
        succeeded=succeeded,
        failed=failed,
        results=results,
    )
