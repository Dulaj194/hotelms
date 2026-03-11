from sqlalchemy.orm import Session

from app.modules.categories.model import Category
from app.modules.items.model import Item
from app.modules.items.schemas import ItemCreateRequest, ItemUpdateRequest


def get_by_id(db: Session, item_id: int, restaurant_id: int) -> Item | None:
    """Fetch item scoped to restaurant. Prevents cross-tenant access."""
    return (
        db.query(Item)
        .filter(Item.id == item_id, Item.restaurant_id == restaurant_id)
        .first()
    )


def list_by_restaurant(db: Session, restaurant_id: int) -> list[Item]:
    return (
        db.query(Item)
        .filter(Item.restaurant_id == restaurant_id)
        .order_by(Item.name.asc())
        .all()
    )


def list_by_category(db: Session, category_id: int, restaurant_id: int) -> list[Item]:
    return (
        db.query(Item)
        .filter(Item.category_id == category_id, Item.restaurant_id == restaurant_id)
        .order_by(Item.name.asc())
        .all()
    )


def category_belongs_to_restaurant(
    db: Session, category_id: int, restaurant_id: int
) -> bool:
    """Verify a category belongs to the given restaurant before linking an item to it."""
    return (
        db.query(Category)
        .filter(Category.id == category_id, Category.restaurant_id == restaurant_id)
        .first()
    ) is not None


def create(db: Session, restaurant_id: int, data: ItemCreateRequest) -> Item:
    """Create an item. Both restaurant_id and category ownership are verified by the service."""
    item = Item(
        name=data.name,
        description=data.description,
        price=data.price,
        image_path=data.image_path,
        is_available=data.is_available,
        category_id=data.category_id,
        restaurant_id=restaurant_id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_by_id(
    db: Session, item_id: int, restaurant_id: int, data: ItemUpdateRequest
) -> Item | None:
    item = get_by_id(db, item_id, restaurant_id)
    if not item:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


def delete_by_id(db: Session, item_id: int, restaurant_id: int) -> bool:
    item = get_by_id(db, item_id, restaurant_id)
    if not item:
        return False
    db.delete(item)
    db.commit()
    return True
