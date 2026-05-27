"""Repository layer for the rooms module.

All methods are tenant-scoped: restaurant_id is always required.
No cross-tenant queries are ever permitted here.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.modules.rooms.model import Room


from sqlalchemy import or_

def list_rooms_by_restaurant(
    db: Session,
    restaurant_id: int,
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str = "asc",
) -> tuple[list[Room], int]:
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
        tuple[list[Room], int]: A tuple containing the list of rooms and the total count.
    """
    query = db.query(Room).filter(Room.restaurant_id == restaurant_id)
    
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Room.room_number.ilike(pattern),
                Room.room_name.ilike(pattern),
            )
        )
        
    total = query.count()
    
    # Sorting
    if sort_by == "room_name":
        order_col = Room.room_name
    elif sort_by == "floor_number":
        order_col = Room.floor_number
    else:
        order_col = Room.room_number
        
    if sort_order.lower() == "desc":
        query = query.order_by(order_col.desc())
    else:
        query = query.order_by(order_col.asc())
        
    items = query.offset(skip).limit(limit).all()
    return items, total


def get_room_by_id_and_restaurant(
    db: Session, room_id: int, restaurant_id: int
) -> Room | None:
    """Fetches a specific room by its ID and restaurant ID.

    Args:
        db (Session): The database session.
        room_id (int): The ID of the room.
        restaurant_id (int): The ID of the restaurant.

    Returns:
        Room | None: The retrieved room, or None if not found.
    """
    return (
        db.query(Room)
        .filter(Room.id == room_id, Room.restaurant_id == restaurant_id)
        .first()
    )


def get_room_by_number_and_restaurant(
    db: Session, room_number: str, restaurant_id: int
) -> Room | None:
    """Fetches a specific room by its number and restaurant ID.

    Args:
        db (Session): The database session.
        room_number (str): The room number.
        restaurant_id (int): The ID of the restaurant.

    Returns:
        Room | None: The retrieved room, or None if not found.
    """
    return (
        db.query(Room)
        .filter(Room.room_number == room_number, Room.restaurant_id == restaurant_id)
        .first()
    )


def create_room(
    db: Session,
    restaurant_id: int,
    room_number: str,
    room_name: str | None,
    floor_number: int | None,
) -> Room:
    """Creates a new room.

    Args:
        db (Session): The database session.
        restaurant_id (int): The ID of the restaurant.
        room_number (str): The room number.
        room_name (str | None): The name of the room.
        floor_number (int | None): The floor number.

    Returns:
        Room: The created room.
    """
    room = Room(
        restaurant_id=restaurant_id,
        room_number=room_number,
        room_name=room_name,
        floor_number=floor_number,
        is_active=True,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def update_room_by_id(
    db: Session,
    room_id: int,
    restaurant_id: int,
    data: dict,
) -> Room | None:
    """Updates an existing room's details.

    Args:
        db (Session): The database session.
        room_id (int): The ID of the room.
        restaurant_id (int): The ID of the restaurant.
        data (dict): A dictionary of field updates.

    Returns:
        Room | None: The updated room, or None if not found.
    """
    room = get_room_by_id_and_restaurant(db, room_id, restaurant_id)
    if not room:
        return None
    for key, value in data.items():
        setattr(room, key, value)
    db.commit()
    db.refresh(room)
    return room


def set_room_active(
    db: Session, room_id: int, restaurant_id: int, is_active: bool
) -> Room | None:
    """Toggles the active status of a room.

    Args:
        db (Session): The database session.
        room_id (int): The ID of the room.
        restaurant_id (int): The ID of the restaurant.
        is_active (bool): True to activate, False to disable.

    Returns:
        Room | None: The updated room, or None if not found.
    """
    room = get_room_by_id_and_restaurant(db, room_id, restaurant_id)
    if not room:
        return None
    room.is_active = is_active
    db.commit()
    db.refresh(room)
    return room


def delete_room_by_id(
    db: Session, room_id: int, restaurant_id: int
) -> bool:
    """Deletes a room permanently.

    Args:
        db (Session): The database session.
        room_id (int): The ID of the room.
        restaurant_id (int): The ID of the restaurant.

    Returns:
        bool: True if deleted, False if not found.
    """
    room = get_room_by_id_and_restaurant(db, room_id, restaurant_id)
    if not room:
        return False
    db.delete(room)
    db.commit()
    return True
