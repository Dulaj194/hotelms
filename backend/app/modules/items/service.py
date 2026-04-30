from fastapi import HTTPException, UploadFile, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.file_storage import delete_uploaded_file, save_upload_file
from app.modules.items import repository
from app.modules.items.schemas import (
    ItemCreateRequest,
    ItemImageUploadResponse,
    ItemMediaUploadResponse,
    ItemResponse,
    ItemUpdateRequest,
)
from app.modules.restaurants import repository as restaurant_repository

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_EXT_MAP = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
_ALLOWED_VIDEO_CONTENT_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
_VIDEO_EXT_MAP = {"video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov"}

_MEDIA_SLOT_TO_FIELD = {
    "primary": "image_path",
    "additional_1": "image_path_2",
    "additional_2": "image_path_3",
    "additional_3": "image_path_4",
    "additional_4": "image_path_5",
    "video": "video_path",
}


def list_items(
    db: Session,
    restaurant_id: int,
    skip: int = 0,
    limit: int = 50,
    category_id: int | None = None,
) -> tuple[list[ItemResponse], int]:
    """List items for restaurant with pagination.

    Returns:
        Tuple of (items, total_count)
    """
    if category_id is not None:
        if not repository.category_belongs_to_restaurant(db, category_id, restaurant_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category not found in your restaurant.",
            )

    items, total = repository.list_by_restaurant(
        db,
        restaurant_id,
        skip=skip,
        limit=limit,
        category_id=category_id,
    )
    return [ItemResponse.model_validate(i) for i in items], total


def get_item(db: Session, item_id: int, restaurant_id: int) -> ItemResponse:
    item = repository.get_by_id(db, item_id, restaurant_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found.")
    return ItemResponse.model_validate(item)


def add_item(db: Session, restaurant_id: int, data: ItemCreateRequest) -> ItemResponse:
    """Create item under the current restaurant.

    Validates that the target category also belongs to this restaurant to prevent cross-tenant injection.
    """
    if not repository.category_belongs_to_restaurant(db, data.category_id, restaurant_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category not found in your restaurant.",
        )

    restaurant = restaurant_repository.get_by_id(db, restaurant_id)
    if restaurant is not None:
        data.currency = (restaurant.currency or "LKR").upper()  # type: ignore[attr-defined]

    item = repository.create(db, restaurant_id, data)
    return ItemResponse.model_validate(item)


def update_item(db: Session, item_id: int, restaurant_id: int, data: ItemUpdateRequest) -> ItemResponse:
    payload = data.model_dump(exclude_unset=True)
    if "category_id" in payload:
        if payload["category_id"] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Item must belong to a category.",
            )
        if not repository.category_belongs_to_restaurant(db, payload["category_id"], restaurant_id):
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

    image_path = await save_upload_file(
        file=file,
        upload_root=settings.upload_dir,
        subdir="items",
        allowed_content_types=_ALLOWED_CONTENT_TYPES,
        ext_map=_EXT_MAP,
        max_size_mb=settings.max_upload_size_mb,
    )
    try:
        item = repository.update_image_path(db, item_id, restaurant_id, image_path)
    except SQLAlchemyError:
        db.rollback()
        delete_uploaded_file(upload_root=settings.upload_dir, public_path=image_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Item image could not be saved. Please try again.",
        )
    if not item:
        delete_uploaded_file(upload_root=settings.upload_dir, public_path=image_path)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found.")

    return ItemImageUploadResponse(image_path=image_path)


async def upload_item_media(
    db: Session,
    item_id: int,
    restaurant_id: int,
    slot: str,
    file: UploadFile,
) -> ItemMediaUploadResponse:
    if slot not in _MEDIA_SLOT_TO_FIELD:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid media slot.",
        )

    is_video_slot = slot == "video"
    allowed_content_types = _ALLOWED_VIDEO_CONTENT_TYPES if is_video_slot else _ALLOWED_CONTENT_TYPES
    ext_map = _VIDEO_EXT_MAP if is_video_slot else _EXT_MAP

    if file.content_type not in allowed_content_types:
        expected = "mp4, webm, mov" if is_video_slot else "jpg, png, webp"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{file.content_type}'. Allowed: {expected}.",
        )

    max_mb = 25 if is_video_slot else settings.max_upload_size_mb
    folder = "videos" if is_video_slot else "items"
    media_path = await save_upload_file(
        file=file,
        upload_root=settings.upload_dir,
        subdir=folder,
        allowed_content_types=allowed_content_types,
        ext_map=ext_map,
        max_size_mb=max_mb,
    )
    field_name = _MEDIA_SLOT_TO_FIELD[slot]
    try:
        item = repository.update_media_path(db, item_id, restaurant_id, field_name, media_path)
    except SQLAlchemyError:
        db.rollback()
        delete_uploaded_file(upload_root=settings.upload_dir, public_path=media_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Item media could not be saved. Please try again.",
        )
    if not item:
        delete_uploaded_file(upload_root=settings.upload_dir, public_path=media_path)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found.")

    return ItemMediaUploadResponse(slot=slot, path=media_path)
