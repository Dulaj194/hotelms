"""Rooms service — admin business logic layer.

Enforces:
- Cross-tenant safety: restaurant_id always from auth context.
- Duplicate room_number prevention (within a restaurant).
- Clean 404/409 error responses.
"""
from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.rooms import repository
from app.modules.rooms.schemas import (
    RoomCreateRequest,
    RoomListResponse,
    RoomResponse,
    RoomStatusResponse,
    RoomUpdateRequest,
)


def _to_response(room) -> RoomResponse:
    return RoomResponse.model_validate(room)


def list_rooms(db: Session, restaurant_id: int) -> RoomListResponse:
    rooms = repository.list_rooms_by_restaurant(db, restaurant_id)
    return RoomListResponse(rooms=[_to_response(r) for r in rooms], total=len(rooms))


def get_room(db: Session, room_id: int, restaurant_id: int) -> RoomResponse:
    room = repository.get_room_by_id_and_restaurant(db, room_id, restaurant_id)
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found."
        )
    return _to_response(room)


def create_room(
    db: Session, restaurant_id: int, data: RoomCreateRequest
) -> RoomResponse:
    # Check for duplicate before attempting the insert
    existing = repository.get_room_by_number_and_restaurant(
        db, data.room_number, restaurant_id
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Room '{data.room_number}' already exists in this restaurant.",
        )
    try:
        room = repository.create_room(
            db,
            restaurant_id=restaurant_id,
            room_number=data.room_number,
            room_name=data.room_name,
            floor_number=data.floor_number,
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Room '{data.room_number}' already exists in this restaurant.",
        )
    return _to_response(room)


def update_room(
    db: Session, room_id: int, restaurant_id: int, data: RoomUpdateRequest
) -> RoomResponse:
    room = repository.get_room_by_id_and_restaurant(db, room_id, restaurant_id)
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found."
        )

    # If room_number is changing, check for duplicate
    if data.room_number is not None and data.room_number != room.room_number:
        existing = repository.get_room_by_number_and_restaurant(
            db, data.room_number, restaurant_id
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Room '{data.room_number}' already exists in this restaurant.",
            )

    update_data: dict = {}
    if data.room_number is not None:
        update_data["room_number"] = data.room_number
    if data.room_name is not None:
        update_data["room_name"] = data.room_name
    if data.floor_number is not None:
        update_data["floor_number"] = data.floor_number

    if not update_data:
        # Nothing to update — return current state
        return _to_response(room)

    updated = repository.update_room_by_id(db, room_id, restaurant_id, update_data)
    return _to_response(updated)


def disable_room(db: Session, room_id: int, restaurant_id: int) -> RoomStatusResponse:
    room = repository.set_room_active(db, room_id, restaurant_id, is_active=False)
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found."
        )
    return RoomStatusResponse.model_validate(room)


def enable_room(db: Session, room_id: int, restaurant_id: int) -> RoomStatusResponse:
    room = repository.set_room_active(db, room_id, restaurant_id, is_active=True)
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found."
        )
    return RoomStatusResponse.model_validate(room)


def delete_room(db: Session, room_id: int, restaurant_id: int) -> None:
    deleted = repository.delete_room_by_id(db, room_id, restaurant_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found."
        )
