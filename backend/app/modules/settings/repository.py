from __future__ import annotations

from datetime import datetime

from sqlalchemy import and_, or_
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
    cursor_created_at: datetime | None = None,
    cursor_request_id: int | None = None,
    sort_order: str = "oldest",
) -> list[SettingsRequest]:
    query = db.query(SettingsRequest).filter(
        SettingsRequest.status == SettingsRequestStatus.PENDING
    )
    if restaurant_id is not None:
        query = query.filter(SettingsRequest.restaurant_id == restaurant_id)

    if cursor_created_at is not None and cursor_request_id is not None:
        if sort_order == "newest":
            query = query.filter(
                or_(
                    SettingsRequest.created_at < cursor_created_at,
                    and_(
                        SettingsRequest.created_at == cursor_created_at,
                        SettingsRequest.request_id < cursor_request_id,
                    ),
                )
            )
        else:
            query = query.filter(
                or_(
                    SettingsRequest.created_at > cursor_created_at,
                    and_(
                        SettingsRequest.created_at == cursor_created_at,
                        SettingsRequest.request_id > cursor_request_id,
                    ),
                )
            )

    if sort_order == "newest":
        query = query.order_by(SettingsRequest.created_at.desc(), SettingsRequest.request_id.desc())
    else:
        query = query.order_by(SettingsRequest.created_at.asc(), SettingsRequest.request_id.asc())

    return query.limit(limit).all()


def count_pending_requests(
    db: Session,
    *,
    restaurant_id: int | None = None,
) -> int:
    query = db.query(SettingsRequest).filter(
        SettingsRequest.status == SettingsRequestStatus.PENDING
    )
    if restaurant_id is not None:
        query = query.filter(SettingsRequest.restaurant_id == restaurant_id)
    return query.count()


def list_reviewed_requests(
    db: Session,
    *,
    restaurant_id: int | None = None,
    status: SettingsRequestStatus | None = None,
    limit: int = 100,
    cursor_reviewed_at: datetime | None = None,
    cursor_request_id: int | None = None,
    sort_order: str = "newest",
) -> list[SettingsRequest]:
    query = db.query(SettingsRequest).filter(
        SettingsRequest.status.in_(
            [SettingsRequestStatus.APPROVED, SettingsRequestStatus.REJECTED]
        )
    )
    if restaurant_id is not None:
        query = query.filter(SettingsRequest.restaurant_id == restaurant_id)
    if status is not None:
        query = query.filter(SettingsRequest.status == status)

    if cursor_reviewed_at is not None and cursor_request_id is not None:
        if sort_order == "oldest":
            query = query.filter(
                or_(
                    SettingsRequest.reviewed_at > cursor_reviewed_at,
                    and_(
                        SettingsRequest.reviewed_at == cursor_reviewed_at,
                        SettingsRequest.request_id > cursor_request_id,
                    ),
                )
            )
        else:
            query = query.filter(
                or_(
                    SettingsRequest.reviewed_at < cursor_reviewed_at,
                    and_(
                        SettingsRequest.reviewed_at == cursor_reviewed_at,
                        SettingsRequest.request_id < cursor_request_id,
                    ),
                )
            )

    if sort_order == "oldest":
        query = query.order_by(
            SettingsRequest.reviewed_at.asc(),
            SettingsRequest.request_id.asc(),
        )
    else:
        query = query.order_by(
            SettingsRequest.reviewed_at.desc(),
            SettingsRequest.request_id.desc(),
        )

    return query.limit(limit).all()


def count_reviewed_requests(
    db: Session,
    *,
    restaurant_id: int | None = None,
    status: SettingsRequestStatus | None = None,
) -> int:
    query = db.query(SettingsRequest).filter(
        SettingsRequest.status.in_(
            [SettingsRequestStatus.APPROVED, SettingsRequestStatus.REJECTED]
        )
    )
    if restaurant_id is not None:
        query = query.filter(SettingsRequest.restaurant_id == restaurant_id)
    if status is not None:
        query = query.filter(SettingsRequest.status == status)
    return query.count()


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
