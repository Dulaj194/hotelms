from sqlalchemy.orm import Session

from app.modules.categories.model import Category
from app.modules.items.model import Item
from app.modules.menus.model import Menu
from app.modules.restaurants.model import Restaurant


def get_public_restaurant_info(db: Session, restaurant_id: int) -> Restaurant | None:
    """Fetch restaurant by ID. Returns None if not found."""
    return db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()


def list_public_categories_by_restaurant(db: Session, restaurant_id: int) -> list[Category]:
    """Return active categories for a restaurant, ordered by sort_order."""
    return (
        db.query(Category)
        .filter(Category.restaurant_id == restaurant_id, Category.is_active.is_(True))
        .order_by(Category.sort_order.asc(), Category.id.asc())
        .all()
    )


def list_public_items_by_restaurant(db: Session, restaurant_id: int) -> list[Item]:
    """Return all items for a restaurant (all availability states, for menu tree building)."""
    return db.query(Item).filter(Item.restaurant_id == restaurant_id).order_by(Item.name.asc()).all()


def get_public_item_by_id(db: Session, item_id: int, restaurant_id: int) -> Item | None:
    """Fetch a single item scoped to a restaurant.

    The restaurant_id param prevents cross-tenant data leakage.
    """
    return db.query(Item).filter(Item.id == item_id, Item.restaurant_id == restaurant_id).first()


def list_public_items_by_category(db: Session, category_id: int, restaurant_id: int) -> list[Item]:
    """Return items for a specific category, scoped to the restaurant.

    category_id alone is not sufficient — restaurant_id enforces tenant boundary.
    """
    return (
        db.query(Item)
        .filter(Item.category_id == category_id, Item.restaurant_id == restaurant_id)
        .order_by(Item.name.asc())
        .all()
    )


def list_public_menus_by_restaurant(db: Session, restaurant_id: int) -> list[Menu]:
    """Return active menus for a restaurant, ordered by sort_order."""
    return (
        db.query(Menu)
        .filter(Menu.restaurant_id == restaurant_id, Menu.is_active.is_(True))
        .order_by(Menu.sort_order.asc(), Menu.id.asc())
        .all()
    )
