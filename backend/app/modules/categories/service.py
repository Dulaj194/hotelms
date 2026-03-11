from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.categories import repository
from app.modules.categories.schemas import (
    CategoryCreateRequest,
    CategoryResponse,
    CategoryUpdateRequest,
)


def list_categories(db: Session, restaurant_id: int) -> list[CategoryResponse]:
    categories = repository.list_by_restaurant(db, restaurant_id)
    return [CategoryResponse.model_validate(c) for c in categories]


def get_category(db: Session, category_id: int, restaurant_id: int) -> CategoryResponse:
    category = repository.get_by_id(db, category_id, restaurant_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")
    return CategoryResponse.model_validate(category)


def add_category(
    db: Session, restaurant_id: int, data: CategoryCreateRequest
) -> CategoryResponse:
    category = repository.create(db, restaurant_id, data)
    return CategoryResponse.model_validate(category)


def update_category(
    db: Session, category_id: int, restaurant_id: int, data: CategoryUpdateRequest
) -> CategoryResponse:
    category = repository.update_by_id(db, category_id, restaurant_id, data)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")
    return CategoryResponse.model_validate(category)


def delete_category(db: Session, category_id: int, restaurant_id: int) -> dict:
    deleted = repository.delete_by_id(db, category_id, restaurant_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")
    return {"message": "Category deleted."}
