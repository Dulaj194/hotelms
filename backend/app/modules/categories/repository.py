from sqlalchemy.orm import Session

from app.modules.categories.model import Category
from app.modules.categories.schemas import CategoryCreateRequest, CategoryUpdateRequest


def get_by_id(db: Session, category_id: int, restaurant_id: int) -> Category | None:
    """Fetch category scoped to restaurant. Prevents cross-tenant access."""
    return db.query(Category).filter(Category.id == category_id, Category.restaurant_id == restaurant_id).first()


def list_by_restaurant(
    db: Session,
    restaurant_id: int,
    skip: int = 0,
    limit: int = 50,
    menu_id: int | None = None,
) -> tuple[list[Category], int]:
    """List categories for restaurant with pagination.

    Returns:
        Tuple of (categories, total_count)
    """
    query = db.query(Category).filter(Category.restaurant_id == restaurant_id)
    if menu_id is not None:
        query = query.filter(Category.menu_id == menu_id)
    total = query.count()
    categories = query.order_by(Category.sort_order.asc(), Category.id.asc()).offset(skip).limit(limit).all()
    return categories, total


def list_by_menu(db: Session, menu_id: int, restaurant_id: int) -> list[Category]:
    return (
        db.query(Category)
        .filter(Category.menu_id == menu_id, Category.restaurant_id == restaurant_id)
        .order_by(Category.sort_order.asc(), Category.id.asc())
        .all()
    )


def menu_belongs_to_restaurant(db: Session, menu_id: int, restaurant_id: int) -> bool:
    """Verify a menu belongs to the given restaurant before linking a category to it."""
    from app.modules.menus.model import Menu

    return (db.query(Menu).filter(Menu.id == menu_id, Menu.restaurant_id == restaurant_id).first()) is not None


def create(db: Session, restaurant_id: int, data: CategoryCreateRequest) -> Category:
    """Create a category. restaurant_id must come from authenticated context."""
    category = Category(
        name=data.name,
        description=data.description,
        image_path=data.image_path,
        sort_order=data.sort_order,
        is_active=data.is_active,
        menu_id=data.menu_id,
        restaurant_id=restaurant_id,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def update_by_id(db: Session, category_id: int, restaurant_id: int, data: CategoryUpdateRequest) -> Category | None:
    category = get_by_id(db, category_id, restaurant_id)
    if not category:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category


def update_image_path(db: Session, category_id: int, restaurant_id: int, image_path: str) -> Category | None:
    category = get_by_id(db, category_id, restaurant_id)
    if not category:
        return None
    category.image_path = image_path
    db.commit()
    db.refresh(category)
    return category


def delete_by_id(db: Session, category_id: int, restaurant_id: int) -> bool:
    category = get_by_id(db, category_id, restaurant_id)
    if not category:
        return False
    db.delete(category)
    db.commit()
    return True
