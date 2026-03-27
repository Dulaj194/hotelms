from __future__ import annotations

from sqlalchemy.orm import Session

from app.modules.settings.model import SettingsRequest, SettingsRequestStatus


def create_request(
    db: Session,
    *,
    restaurant_id: int,
    requested_by: int,
    requested_changes: dict,
    current_settings: dict,
    request_reason: str | None,
) -> SettingsRequest:
    request = SettingsRequest(
        restaurant_id=restaurant_id,
        requested_by=requested_by,
        requested_changes=requested_changes,
        current_settings=current_settings,
        status=SettingsRequestStatus.PENDING,
        request_reason=request_reason,
    )
    db.add(request)
    db.flush()
    db.refresh(request)
    return request


def get_request_by_id(db: Session, request_id: int) -> SettingsRequest | None:
    return (
        db.query(SettingsRequest)
        .filter(SettingsRequest.request_id == request_id)
        .first()
    )


def list_requests_by_restaurant(
    db: Session,
    *,
    restaurant_id: int,
    limit: int = 100,
) -> list[SettingsRequest]:
    return (
        db.query(SettingsRequest)
        .filter(SettingsRequest.restaurant_id == restaurant_id)
        .order_by(SettingsRequest.created_at.desc(), SettingsRequest.request_id.desc())
        .limit(limit)
        .all()
    )


def list_pending_requests(
    db: Session,
    *,
    restaurant_id: int | None = None,
    limit: int = 100,
) -> list[SettingsRequest]:
    query = db.query(SettingsRequest).filter(
        SettingsRequest.status == SettingsRequestStatus.PENDING
    )
    if restaurant_id is not None:
        query = query.filter(SettingsRequest.restaurant_id == restaurant_id)
    return (
        query.order_by(SettingsRequest.created_at.asc(), SettingsRequest.request_id.asc())
        .limit(limit)
        .all()
    )


def has_pending_request_for_restaurant(db: Session, *, restaurant_id: int) -> bool:
    found = (
        db.query(SettingsRequest.request_id)
        .filter(
            SettingsRequest.restaurant_id == restaurant_id,
            SettingsRequest.status == SettingsRequestStatus.PENDING,
        )
        .first()
    )
    return found is not None
