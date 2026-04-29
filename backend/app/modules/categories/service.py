from fastapi import HTTPException, UploadFile, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.file_storage import delete_uploaded_file, save_upload_file
from app.modules.categories import repository
from app.modules.categories.schemas import (
    CategoryCreateRequest,
    CategoryImageUploadResponse,
    CategoryResponse,
    CategoryUpdateRequest,
)

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_EXT_MAP = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def list_categories(
    db: Session,
    restaurant_id: int,
    skip: int = 0,
    limit: int = 50,
    menu_id: int | None = None,
) -> tuple[list[CategoryResponse], int]:
    """List categories for restaurant with pagination.

    Returns:
        Tuple of (categories, total_count)
    """
    if menu_id is not None:
        if not repository.menu_belongs_to_restaurant(db, menu_id, restaurant_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Menu not found or does not belong to your restaurant.",
            )

    categories, total = repository.list_by_restaurant(
        db,
        restaurant_id,
        skip=skip,
        limit=limit,
        menu_id=menu_id,
    )
    return [CategoryResponse.model_validate(c) for c in categories], total


def get_category(db: Session, category_id: int, restaurant_id: int) -> CategoryResponse:
    category = repository.get_by_id(db, category_id, restaurant_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")
    return CategoryResponse.model_validate(category)


def add_category(db: Session, restaurant_id: int, data: CategoryCreateRequest) -> CategoryResponse:
    if not repository.menu_belongs_to_restaurant(db, data.menu_id, restaurant_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Menu not found or does not belong to your restaurant.",
        )
    category = repository.create(db, restaurant_id, data)
    return CategoryResponse.model_validate(category)


def update_category(db: Session, category_id: int, restaurant_id: int, data: CategoryUpdateRequest) -> CategoryResponse:
    payload = data.model_dump(exclude_unset=True)
    if "menu_id" in payload:
        if payload["menu_id"] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category must belong to a menu.",
            )
        if not repository.menu_belongs_to_restaurant(db, payload["menu_id"], restaurant_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Menu not found or does not belong to your restaurant.",
            )

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

    image_path = await save_upload_file(
        file=file,
        upload_root=settings.upload_dir,
        subdir="categories",
        allowed_content_types=_ALLOWED_CONTENT_TYPES,
        ext_map=_EXT_MAP,
        max_size_mb=settings.max_upload_size_mb,
    )
    try:
        category = repository.update_image_path(db, category_id, restaurant_id, image_path)
    except SQLAlchemyError:
        db.rollback()
        delete_uploaded_file(upload_root=settings.upload_dir, public_path=image_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Category image could not be saved. Please try again.",
        )
    if not category:
        delete_uploaded_file(upload_root=settings.upload_dir, public_path=image_path)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")

    return CategoryImageUploadResponse(image_path=image_path)
