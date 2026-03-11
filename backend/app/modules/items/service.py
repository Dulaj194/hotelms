from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.items import repository
from app.modules.items.schemas import ItemCreateRequest, ItemResponse, ItemUpdateRequest


def list_items(db: Session, restaurant_id: int) -> list[ItemResponse]:
    items = repository.list_by_restaurant(db, restaurant_id)
    return [ItemResponse.model_validate(i) for i in items]


def get_item(db: Session, item_id: int, restaurant_id: int) -> ItemResponse:
    item = repository.get_by_id(db, item_id, restaurant_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found.")
    return ItemResponse.model_validate(item)


def add_item(db: Session, restaurant_id: int, data: ItemCreateRequest) -> ItemResponse:
    """Create item under the current restaurant.

    Validates that the target category also belongs to this restaurant
    to prevent cross-tenant category injection.
    """
    if not repository.category_belongs_to_restaurant(db, data.category_id, restaurant_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category not found in your restaurant.",
        )
    item = repository.create(db, restaurant_id, data)
    return ItemResponse.model_validate(item)


def update_item(
    db: Session, item_id: int, restaurant_id: int, data: ItemUpdateRequest
) -> ItemResponse:
    # If changing category, verify it belongs to this restaurant
    if data.category_id is not None:
        if not repository.category_belongs_to_restaurant(db, data.category_id, restaurant_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category not found in your restaurant.",
            )
    item = repository.update_by_id(db, item_id, restaurant_id, data)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found.")
    return ItemResponse.model_validate(item)


def delete_item(db: Session, item_id: int, restaurant_id: int) -> dict:
    deleted = repository.delete_by_id(db, item_id, restaurant_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found.")
    return {"message": "Item deleted."}
