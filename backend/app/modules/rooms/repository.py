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
    """Return rooms for a restaurant with pagination and filtering."""
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
    """Fetch a room scoped to the restaurant. Returns None if not found or wrong tenant."""
    return (
        db.query(Room)
        .filter(Room.id == room_id, Room.restaurant_id == restaurant_id)
        .first()
    )


def get_room_by_number_and_restaurant(
    db: Session, room_number: str, restaurant_id: int
) -> Room | None:
    """Fetch a room by room_number within a restaurant."""
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
    """Persist a new room record."""
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
    """Apply a dict of field updates to a room. Caller must ensure data is safe."""
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
    """Toggle the is_active flag on a room."""
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
    """Delete a room. Returns True if deleted, False if not found."""
    room = get_room_by_id_and_restaurant(db, room_id, restaurant_id)
    if not room:
        return False
    db.delete(room)
    db.commit()
    return True
