"""Repository layer for housekeeping tasks."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.housekeeping.model import (
    HousekeepingChecklistItem,
    HousekeepingEventLog,
    HousekeepingMaintenanceTicket,
    HousekeepingRequest,
)


def create_housekeeping_request(
    db: Session,
    *,
    restaurant_id: int,
    room_id: int,
    room_session_id: str | None,
    room_number_snapshot: str,
    guest_name: str | None,
    request_type: str,
    priority: str,
    message: str,
    requested_for_at: datetime | None,
    due_at: datetime | None,
    audio_url: str | None,
    status: str,
    checklist_items: list[tuple[str, str, bool]],
) -> HousekeepingRequest:
    req = HousekeepingRequest(
        restaurant_id=restaurant_id,
        room_id=room_id,
        room_session_id=room_session_id,
        room_number_snapshot=room_number_snapshot,
        guest_name=guest_name,
        request_type=request_type,
        priority=priority,
        message=message,
        requested_for_at=requested_for_at,
        due_at=due_at,
        audio_url=audio_url,
        status=status,
    )
    db.add(req)
    db.flush()

    for item_code, label, is_mandatory in checklist_items:
        db.add(
            HousekeepingChecklistItem(
                request_id=req.id,
                item_code=item_code,
                label=label,
                is_mandatory=is_mandatory,
            )
        )

    db.commit()
    db.refresh(req)
    return req


def get_request_by_id_and_restaurant(
    db: Session,
    request_id: int,
    restaurant_id: int,
) -> HousekeepingRequest | None:
    return (
        db.query(HousekeepingRequest)
        .filter(
            HousekeepingRequest.id == request_id,
            HousekeepingRequest.restaurant_id == restaurant_id,
        )
        .first()
    )


def get_request_by_id_and_session(
    db: Session,
    *,
    request_id: int,
    restaurant_id: int,
    room_session_id: str,
) -> HousekeepingRequest | None:
    return (
        db.query(HousekeepingRequest)
        .filter(
            HousekeepingRequest.id == request_id,
            HousekeepingRequest.restaurant_id == restaurant_id,
            HousekeepingRequest.room_session_id == room_session_id,
        )
        .first()
    )


def list_requests_by_restaurant(
    db: Session,
    restaurant_id: int,
    *,
    status: str | None = None,
    room_number: str | None = None,
    request_type: str | None = None,
    priority: str | None = None,
    assigned_to_user_id: int | None = None,
) -> list[HousekeepingRequest]:
    q = db.query(HousekeepingRequest).filter(HousekeepingRequest.restaurant_id == restaurant_id)
    if status:
        q = q.filter(HousekeepingRequest.status == status)
    if room_number:
        q = q.filter(HousekeepingRequest.room_number_snapshot == room_number)
    if request_type:
        q = q.filter(HousekeepingRequest.request_type == request_type)
    if priority:
        q = q.filter(HousekeepingRequest.priority == priority)
    if assigned_to_user_id is not None:
        q = q.filter(HousekeepingRequest.assigned_to_user_id == assigned_to_user_id)
    return q.order_by(HousekeepingRequest.submitted_at.desc()).all()


def list_requests_by_session(
    db: Session,
    *,
    restaurant_id: int,
    room_session_id: str,
) -> list[HousekeepingRequest]:
    return (
        db.query(HousekeepingRequest)
        .filter(
            HousekeepingRequest.restaurant_id == restaurant_id,
            HousekeepingRequest.room_session_id == room_session_id,
        )
        .order_by(HousekeepingRequest.submitted_at.desc())
        .all()
    )


def save_request(db: Session, req: HousekeepingRequest) -> HousekeepingRequest:
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def get_checklist_item_for_request(
    db: Session,
    *,
    request_id: int,
    item_id: int,
    restaurant_id: int,
) -> HousekeepingChecklistItem | None:
    return (
        db.query(HousekeepingChecklistItem)
        .join(HousekeepingRequest, HousekeepingRequest.id == HousekeepingChecklistItem.request_id)
        .filter(
            HousekeepingChecklistItem.id == item_id,
            HousekeepingChecklistItem.request_id == request_id,
            HousekeepingRequest.restaurant_id == restaurant_id,
        )
        .first()
    )


def count_incomplete_mandatory_checklist_items(
    db: Session,
    *,
    request_id: int,
) -> int:
    return int(
        db.query(func.count(HousekeepingChecklistItem.id))
        .filter(
            HousekeepingChecklistItem.request_id == request_id,
            HousekeepingChecklistItem.is_mandatory.is_(True),
            HousekeepingChecklistItem.is_completed.is_(False),
        )
        .scalar()
        or 0
    )


def create_maintenance_ticket(
    db: Session,
    *,
    request_id: int,
    restaurant_id: int,
    room_id: int,
    issue_type: str,
    description: str,
    photo_proof_url: str | None,
    created_by_user_id: int | None,
) -> HousekeepingMaintenanceTicket:
    ticket = HousekeepingMaintenanceTicket(
        request_id=request_id,
        restaurant_id=restaurant_id,
        room_id=room_id,
        issue_type=issue_type,
        description=description,
        photo_proof_url=photo_proof_url,
        created_by_user_id=created_by_user_id,
        status="open",
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


def get_maintenance_ticket(
    db: Session,
    *,
    ticket_id: int,
    request_id: int,
    restaurant_id: int,
) -> HousekeepingMaintenanceTicket | None:
    return (
        db.query(HousekeepingMaintenanceTicket)
        .filter(
            HousekeepingMaintenanceTicket.id == ticket_id,
            HousekeepingMaintenanceTicket.request_id == request_id,
            HousekeepingMaintenanceTicket.restaurant_id == restaurant_id,
        )
        .first()
    )


def has_open_maintenance_ticket_for_room(
    db: Session,
    *,
    restaurant_id: int,
    room_id: int,
) -> bool:
    count = (
        db.query(func.count(HousekeepingMaintenanceTicket.id))
        .filter(
            HousekeepingMaintenanceTicket.restaurant_id == restaurant_id,
            HousekeepingMaintenanceTicket.room_id == room_id,
            HousekeepingMaintenanceTicket.status == "open",
        )
        .scalar()
        or 0
    )
    return int(count) > 0


def save_maintenance_ticket(
    db: Session,
    ticket: HousekeepingMaintenanceTicket,
) -> HousekeepingMaintenanceTicket:
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


def create_event_log(
    db: Session,
    *,
    request_id: int,
    restaurant_id: int,
    actor_user_id: int | None,
    event_type: str,
    from_status: str | None,
    to_status: str | None,
    note: str | None = None,
) -> HousekeepingEventLog:
    event = HousekeepingEventLog(
        request_id=request_id,
        restaurant_id=restaurant_id,
        actor_user_id=actor_user_id,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        note=note,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def list_pending_requests(
    db: Session,
    *,
    restaurant_id: int,
) -> list[HousekeepingRequest]:
    return (
        db.query(HousekeepingRequest)
        .filter(
            HousekeepingRequest.restaurant_id == restaurant_id,
            HousekeepingRequest.status.notin_(["ready", "cancelled", "done"]),
        )
        .order_by(HousekeepingRequest.priority.asc(), HousekeepingRequest.submitted_at.asc())
        .all()
    )


def list_requests_by_date_range(
    db: Session,
    *,
    restaurant_id: int,
    from_dt: datetime,
    to_dt: datetime,
) -> list[HousekeepingRequest]:
    return (
        db.query(HousekeepingRequest)
        .filter(
            HousekeepingRequest.restaurant_id == restaurant_id,
            HousekeepingRequest.submitted_at >= from_dt,
            HousekeepingRequest.submitted_at <= to_dt,
        )
        .order_by(HousekeepingRequest.submitted_at.asc())
        .all()
    )


def delete_request_by_restaurant(
    db: Session,
    *,
    request_id: int,
    restaurant_id: int,
) -> HousekeepingRequest | None:
    req = get_request_by_id_and_restaurant(db, request_id, restaurant_id)
    if req is None:
        return None
    db.delete(req)
    db.commit()
    return req


def delete_request_by_session(
    db: Session,
    *,
    request_id: int,
    restaurant_id: int,
    room_session_id: str,
) -> HousekeepingRequest | None:
    req = get_request_by_id_and_session(
        db,
        request_id=request_id,
        restaurant_id=restaurant_id,
        room_session_id=room_session_id,
    )
    if req is None:
        return None
    db.delete(req)
    db.commit()
    return req


def count_pending_requests(
    db: Session,
    *,
    restaurant_id: int,
) -> int:
    pending_count = (
        db.query(func.count(HousekeepingRequest.id))
        .filter(
            HousekeepingRequest.restaurant_id == restaurant_id,
            HousekeepingRequest.status.notin_(["ready", "cancelled", "done"]),
        )
        .scalar()
        or 0
    )
    return int(pending_count)


def list_expired_requests_for_cleanup(
    db: Session,
    *,
    restaurant_id: int,
    cutoff_dt: datetime,
) -> list[HousekeepingRequest]:
    return (
        db.query(HousekeepingRequest)
        .filter(
            HousekeepingRequest.restaurant_id == restaurant_id,
            HousekeepingRequest.created_at < cutoff_dt,
        )
        .all()
    )


def delete_requests_by_ids(
    db: Session,
    *,
    restaurant_id: int,
    request_ids: list[int],
) -> int:
    if not request_ids:
        return 0
    deleted = (
        db.query(HousekeepingRequest)
        .filter(
            HousekeepingRequest.restaurant_id == restaurant_id,
            HousekeepingRequest.id.in_(request_ids),
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return int(deleted)
