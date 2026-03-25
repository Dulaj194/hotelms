"""Rooms admin router.

Read endpoints allow owner/admin/housekeeper.
Write endpoints require owner/admin.
restaurant_id is always derived from authenticated context.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_restaurant_id, get_db, require_roles
from app.modules.rooms import service
from app.modules.rooms.schemas import (
    RoomCreateRequest,
    RoomListResponse,
    RoomResponse,
    RoomStatusResponse,
    RoomUpdateRequest,
)

router = APIRouter()

_ROOM_READ_ROLES = ("owner", "admin", "housekeeper")
_ROOM_WRITE_ROLES = ("owner", "admin")


@router.get("", response_model=RoomListResponse)
def list_rooms(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_ROOM_READ_ROLES)),
) -> RoomListResponse:
    """List all rooms in the current restaurant."""
    return service.list_rooms(db, restaurant_id)


@router.post("", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(
    payload: RoomCreateRequest,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_ROOM_WRITE_ROLES)),
) -> RoomResponse:
    """Create a new room in the current restaurant."""
    return service.create_room(db, restaurant_id, payload)


@router.get("/{room_id}", response_model=RoomResponse)
def get_room(
    room_id: int,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_ROOM_READ_ROLES)),
) -> RoomResponse:
    """Get one room by id, scoped to current restaurant."""
    return service.get_room(db, room_id, restaurant_id)


@router.patch("/{room_id}", response_model=RoomResponse)
def update_room(
    room_id: int,
    payload: RoomUpdateRequest,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_ROOM_WRITE_ROLES)),
) -> RoomResponse:
    """Update a room in the current restaurant."""
    return service.update_room(db, room_id, restaurant_id, payload)


@router.patch("/{room_id}/disable", response_model=RoomStatusResponse)
def disable_room(
    room_id: int,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_ROOM_WRITE_ROLES)),
) -> RoomStatusResponse:
    """Mark a room as inactive."""
    return service.disable_room(db, room_id, restaurant_id)


@router.patch("/{room_id}/enable", response_model=RoomStatusResponse)
def enable_room(
    room_id: int,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_ROOM_WRITE_ROLES)),
) -> RoomStatusResponse:
    """Mark a room as active."""
    return service.enable_room(db, room_id, restaurant_id)


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(
    room_id: int,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_ROOM_WRITE_ROLES)),
) -> None:
    """Delete a room from the current restaurant."""
    service.delete_room(db, room_id, restaurant_id)
