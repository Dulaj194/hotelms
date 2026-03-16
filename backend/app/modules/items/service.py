import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.items import repository
from app.modules.items.schemas import (
    ItemCreateRequest,
    ItemImageUploadResponse,
    ItemResponse,
    ItemUpdateRequest,
)

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_EXT_MAP = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


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

    Validates that the target category and optional subcategory also belong to this
    restaurant to prevent cross-tenant injection.
    """
    if not repository.category_belongs_to_restaurant(db, data.category_id, restaurant_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category not found in your restaurant.",
        )
    if data.subcategory_id is not None:
        if not repository.subcategory_belongs_to_restaurant(db, data.subcategory_id, restaurant_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Subcategory not found or does not belong to your restaurant.",
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
    # If changing subcategory, verify it belongs to this restaurant
    if data.subcategory_id is not None:
        if not repository.subcategory_belongs_to_restaurant(db, data.subcategory_id, restaurant_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Subcategory not found or does not belong to your restaurant.",
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


async def upload_item_image(
    db: Session,
    item_id: int,
    restaurant_id: int,
    file: UploadFile,
) -> ItemImageUploadResponse:
    """Validate, save, and register an item image.

    SECURITY: Extension derived from content-type, never from original filename.
    UUID filename prevents directory traversal. Size capped at settings limit.
    """
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{file.content_type}'. Allowed: jpg, png, webp.",
        )

    content = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {settings.max_upload_size_mb} MB size limit.",
        )

    ext = _EXT_MAP[file.content_type]  # type: ignore[index]
    filename = f"{uuid.uuid4().hex}{ext}"
    upload_path = Path(settings.upload_dir) / "items"
    upload_path.mkdir(parents=True, exist_ok=True)
    (upload_path / filename).write_bytes(content)

    image_path = f"/uploads/items/{filename}"
    item = repository.update_image_path(db, item_id, restaurant_id, image_path)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found.")

    return ItemImageUploadResponse(image_path=image_path)
