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


def _to_response(room: repository.Room) -> RoomResponse:
    """Converts a Room SQLAlchemy model to a Pydantic RoomResponse model.

    Args:
        room: The Room SQLAlchemy model instance.

    Returns:
        RoomResponse: The Pydantic model representing the room.
    """
    return RoomResponse.model_validate(room)


def list_rooms(
    db: Session, 
    restaurant_id: int,
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str = "asc",
) -> tuple[list[RoomResponse], int]:
    """Retrieves a paginated list of rooms for a specific restaurant.

    Args:
        db (Session): The database session.
        restaurant_id (int): The ID of the restaurant.
        skip (int, optional): The number of records to skip. Defaults to 0.
        limit (int, optional): The maximum number of records to return. Defaults to 50.
        search (str | None, optional): An optional search term to filter rooms by number or name. Defaults to None.
        sort_by (str | None, optional): The column to sort by. Defaults to None.
        sort_order (str, optional): The sort order ("asc" or "desc"). Defaults to "asc".

    Returns:
        tuple[list[RoomResponse], int]: A tuple containing the list of rooms and the total count.
    """
    rooms, total = repository.list_rooms_by_restaurant(
        db, 
        restaurant_id, 
        skip=skip, 
        limit=limit,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return [_to_response(r) for r in rooms], total


def get_room(db: Session, room_id: int, restaurant_id: int) -> RoomResponse:
    """Retrieves a specific room by its ID and restaurant ID.

    Args:
        db (Session): The database session.
        room_id (int): The ID of the room.
        restaurant_id (int): The ID of the restaurant.

    Raises:
        HTTPException: If the room is not found (404).

    Returns:
        RoomResponse: The retrieved room.
    """
    room = repository.get_room_by_id_and_restaurant(db, room_id, restaurant_id)
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found."
        )
    return _to_response(room)


def create_room(
    db: Session, restaurant_id: int, data: RoomCreateRequest
) -> RoomResponse:
    """Creates a new room for a specific restaurant.

    Args:
        db (Session): The database session.
        restaurant_id (int): The ID of the restaurant.
        data (RoomCreateRequest): The data for the new room.

    Raises:
        HTTPException: If a room with the same number already exists (409).

    Returns:
        RoomResponse: The created room.
    """
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
    """Updates an existing room's details.

    Args:
        db (Session): The database session.
        room_id (int): The ID of the room to update.
        restaurant_id (int): The ID of the restaurant.
        data (RoomUpdateRequest): The new data for the room.

    Raises:
        HTTPException: If the room is not found (404) or if the new room number is already taken (409).

    Returns:
        RoomResponse: The updated room.
    """
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
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found."
        )
    return _to_response(updated)


def disable_room(db: Session, room_id: int, restaurant_id: int) -> RoomStatusResponse:
    """Disables a room, marking it as inactive.

    Args:
        db (Session): The database session.
        room_id (int): The ID of the room.
        restaurant_id (int): The ID of the restaurant.

    Raises:
        HTTPException: If the room is not found (404).

    Returns:
        RoomStatusResponse: The updated status of the room.
    """
    room = repository.set_room_active(db, room_id, restaurant_id, is_active=False)
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found."
        )
    return RoomStatusResponse.model_validate(room)


def enable_room(db: Session, room_id: int, restaurant_id: int) -> RoomStatusResponse:
    """Enables a room, marking it as active.

    Args:
        db (Session): The database session.
        room_id (int): The ID of the room.
        restaurant_id (int): The ID of the restaurant.

    Raises:
        HTTPException: If the room is not found (404).

    Returns:
        RoomStatusResponse: The updated status of the room.
    """
    room = repository.set_room_active(db, room_id, restaurant_id, is_active=True)
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found."
        )
    return RoomStatusResponse.model_validate(room)


def delete_room(db: Session, room_id: int, restaurant_id: int) -> None:
    """Deletes a room permanently.

    Args:
        db (Session): The database session.
        room_id (int): The ID of the room.
        restaurant_id (int): The ID of the restaurant.

    Raises:
        HTTPException: If the room is not found (404).
    """
    deleted = repository.delete_room_by_id(db, room_id, restaurant_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found."
        )
