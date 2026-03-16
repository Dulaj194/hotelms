import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.subcategories import repository
from app.modules.subcategories.schemas import (
    SubcategoryCreateRequest,
    SubcategoryImageUploadResponse,
    SubcategoryResponse,
    SubcategoryUpdateRequest,
)

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_EXT_MAP = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def list_subcategories(db: Session, restaurant_id: int) -> list[SubcategoryResponse]:
    subcats = repository.list_by_restaurant(db, restaurant_id)
    return [SubcategoryResponse.model_validate(s) for s in subcats]


def get_subcategory(
    db: Session, subcategory_id: int, restaurant_id: int
) -> SubcategoryResponse:
    subcat = repository.get_by_id(db, subcategory_id, restaurant_id)
    if not subcat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Subcategory not found."
        )
    return SubcategoryResponse.model_validate(subcat)


def add_subcategory(
    db: Session, restaurant_id: int, data: SubcategoryCreateRequest
) -> SubcategoryResponse:
    # Verify category belongs to this restaurant before linking
    if not repository.category_belongs_to_restaurant(db, data.category_id, restaurant_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category not found or does not belong to your restaurant.",
        )
    subcat = repository.create(db, restaurant_id, data)
    return SubcategoryResponse.model_validate(subcat)


def update_subcategory(
    db: Session,
    subcategory_id: int,
    restaurant_id: int,
    data: SubcategoryUpdateRequest,
) -> SubcategoryResponse:
    # If category_id is being changed, verify ownership
    if data.category_id is not None:
        if not repository.category_belongs_to_restaurant(db, data.category_id, restaurant_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category not found or does not belong to your restaurant.",
            )
    subcat = repository.update_by_id(db, subcategory_id, restaurant_id, data)
    if not subcat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Subcategory not found."
        )
    return SubcategoryResponse.model_validate(subcat)


def delete_subcategory(db: Session, subcategory_id: int, restaurant_id: int) -> dict:
    deleted = repository.delete_by_id(db, subcategory_id, restaurant_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Subcategory not found."
        )
    return {"message": "Subcategory deleted."}


async def upload_subcategory_image(
    db: Session,
    subcategory_id: int,
    restaurant_id: int,
    file: UploadFile,
) -> SubcategoryImageUploadResponse:
    """Validate, save, and register a subcategory image.

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
    upload_path = Path(settings.upload_dir) / "subcategories"
    upload_path.mkdir(parents=True, exist_ok=True)
    (upload_path / filename).write_bytes(content)

    image_path = f"/uploads/subcategories/{filename}"
    subcat = repository.update_image_path(db, subcategory_id, restaurant_id, image_path)
    if not subcat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Subcategory not found."
        )

    return SubcategoryImageUploadResponse(image_path=image_path)
