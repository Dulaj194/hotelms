from sqlalchemy.orm import Session

from app.modules.categories.model import Category
from app.modules.subcategories.model import Subcategory
from app.modules.subcategories.schemas import (
    SubcategoryCreateRequest,
    SubcategoryUpdateRequest,
)


def get_by_id(db: Session, subcategory_id: int, restaurant_id: int) -> Subcategory | None:
    """Fetch subcategory scoped to restaurant. Prevents cross-tenant access."""
    return (
        db.query(Subcategory)
        .filter(
            Subcategory.id == subcategory_id,
            Subcategory.restaurant_id == restaurant_id,
        )
        .first()
    )


def list_by_restaurant(db: Session, restaurant_id: int) -> list[Subcategory]:
    return (
        db.query(Subcategory)
        .filter(Subcategory.restaurant_id == restaurant_id)
        .order_by(Subcategory.sort_order.asc(), Subcategory.id.asc())
        .all()
    )


def list_by_category(
    db: Session, category_id: int, restaurant_id: int
) -> list[Subcategory]:
    return (
        db.query(Subcategory)
        .filter(
            Subcategory.category_id == category_id,
            Subcategory.restaurant_id == restaurant_id,
        )
        .order_by(Subcategory.sort_order.asc(), Subcategory.id.asc())
        .all()
    )


def category_belongs_to_restaurant(
    db: Session, category_id: int, restaurant_id: int
) -> bool:
    """Verify a category belongs to the given restaurant before linking a subcategory."""
    return (
        db.query(Category)
        .filter(Category.id == category_id, Category.restaurant_id == restaurant_id)
        .first()
    ) is not None


def create(
    db: Session, restaurant_id: int, data: SubcategoryCreateRequest
) -> Subcategory:
    """Create a subcategory. restaurant_id and category ownership verified by service."""
    subcat = Subcategory(
        name=data.name,
        description=data.description,
        sort_order=data.sort_order,
        is_active=data.is_active,
        category_id=data.category_id,
        restaurant_id=restaurant_id,
    )
    db.add(subcat)
    db.commit()
    db.refresh(subcat)
    return subcat


def update_by_id(
    db: Session, subcategory_id: int, restaurant_id: int, data: SubcategoryUpdateRequest
) -> Subcategory | None:
    subcat = get_by_id(db, subcategory_id, restaurant_id)
    if not subcat:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(subcat, field, value)
    db.commit()
    db.refresh(subcat)
    return subcat


def update_image_path(
    db: Session, subcategory_id: int, restaurant_id: int, image_path: str
) -> Subcategory | None:
    subcat = get_by_id(db, subcategory_id, restaurant_id)
    if not subcat:
        return None
    subcat.image_path = image_path
    db.commit()
    db.refresh(subcat)
    return subcat


def delete_by_id(db: Session, subcategory_id: int, restaurant_id: int) -> bool:
    subcat = get_by_id(db, subcategory_id, restaurant_id)
    if not subcat:
        return False
    db.delete(subcat)
    db.commit()
    return True
