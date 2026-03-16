from sqlalchemy.orm import Session

from app.modules.categories.model import Category
from app.modules.categories.schemas import CategoryCreateRequest, CategoryUpdateRequest


def get_by_id(db: Session, category_id: int, restaurant_id: int) -> Category | None:
    """Fetch category scoped to restaurant. Prevents cross-tenant access."""
    return (
        db.query(Category)
        .filter(Category.id == category_id, Category.restaurant_id == restaurant_id)
        .first()
    )


def list_by_restaurant(db: Session, restaurant_id: int) -> list[Category]:
    return (
        db.query(Category)
        .filter(Category.restaurant_id == restaurant_id)
        .order_by(Category.sort_order.asc(), Category.id.asc())
        .all()
    )


def create(db: Session, restaurant_id: int, data: CategoryCreateRequest) -> Category:
    """Create a category. restaurant_id must come from authenticated context."""
    category = Category(
        name=data.name,
        description=data.description,
        image_path=data.image_path,
        sort_order=data.sort_order,
        is_active=data.is_active,
        restaurant_id=restaurant_id,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def update_by_id(
    db: Session, category_id: int, restaurant_id: int, data: CategoryUpdateRequest
) -> Category | None:
    category = get_by_id(db, category_id, restaurant_id)
    if not category:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category


def update_image_path(
    db: Session, category_id: int, restaurant_id: int, image_path: str
) -> Category | None:
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
