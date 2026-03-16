import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.categories import repository
from app.modules.categories.schemas import (
    CategoryCreateRequest,
    CategoryImageUploadResponse,
    CategoryResponse,
    CategoryUpdateRequest,
)

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_EXT_MAP = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


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
    if data.menu_id is not None:
        if not repository.menu_belongs_to_restaurant(db, data.menu_id, restaurant_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Menu not found or does not belong to your restaurant.",
            )
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


async def upload_category_image(
    db: Session,
    category_id: int,
    restaurant_id: int,
    file: UploadFile,
) -> CategoryImageUploadResponse:
    """Validate, save, and register a category image.

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
    upload_path = Path(settings.upload_dir) / "categories"
    upload_path.mkdir(parents=True, exist_ok=True)
    (upload_path / filename).write_bytes(content)

    image_path = f"/uploads/categories/{filename}"
    category = repository.update_image_path(db, category_id, restaurant_id, image_path)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")

    return CategoryImageUploadResponse(image_path=image_path)
