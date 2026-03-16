from sqlalchemy.orm import Session

from app.modules.menus.model import Menu
from app.modules.menus.schemas import MenuCreateRequest, MenuUpdateRequest


def get_by_id(db: Session, menu_id: int, restaurant_id: int) -> Menu | None:
    """Fetch menu scoped to restaurant. Prevents cross-tenant access."""
    return (
        db.query(Menu)
        .filter(Menu.id == menu_id, Menu.restaurant_id == restaurant_id)
        .first()
    )


def list_by_restaurant(db: Session, restaurant_id: int) -> list[Menu]:
    return (
        db.query(Menu)
        .filter(Menu.restaurant_id == restaurant_id)
        .order_by(Menu.sort_order.asc(), Menu.id.asc())
        .all()
    )


def create(db: Session, restaurant_id: int, data: MenuCreateRequest) -> Menu:
    """Create a menu. restaurant_id must come from authenticated context."""
    menu = Menu(
        name=data.name,
        description=data.description,
        sort_order=data.sort_order,
        is_active=data.is_active,
        restaurant_id=restaurant_id,
    )
    db.add(menu)
    db.commit()
    db.refresh(menu)
    return menu


def update_by_id(
    db: Session, menu_id: int, restaurant_id: int, data: MenuUpdateRequest
) -> Menu | None:
    menu = get_by_id(db, menu_id, restaurant_id)
    if not menu:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(menu, field, value)
    db.commit()
    db.refresh(menu)
    return menu


def update_image_path(
    db: Session, menu_id: int, restaurant_id: int, image_path: str
) -> Menu | None:
    menu = get_by_id(db, menu_id, restaurant_id)
    if not menu:
        return None
    menu.image_path = image_path
    db.commit()
    db.refresh(menu)
    return menu


def delete_by_id(db: Session, menu_id: int, restaurant_id: int) -> bool:
    menu = get_by_id(db, menu_id, restaurant_id)
    if not menu:
        return False
    db.delete(menu)
    db.commit()
    return True
