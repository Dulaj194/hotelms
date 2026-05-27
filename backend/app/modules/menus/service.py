from fastapi import HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.file_storage import delete_uploaded_file, save_upload_file
from app.modules.menus import repository
from app.modules.menus.schemas import (
    MenuCreateRequest,
    MenuImageUploadResponse,
    MenuResponse,
    MenuUpdateRequest,
)

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_EXT_MAP = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def list_menus(
    db: Session, 
    restaurant_id: int,
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str = "asc",
) -> tuple[list[MenuResponse], int]:
    menus, total = repository.list_by_restaurant(
        db, 
        restaurant_id,
        skip=skip,
        limit=limit,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return [MenuResponse.model_validate(m) for m in menus], total


def get_menu(db: Session, menu_id: int, restaurant_id: int) -> MenuResponse:
    menu = repository.get_by_id(db, menu_id, restaurant_id)
    if not menu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu not found.")
    return MenuResponse.model_validate(menu)


def add_menu(db: Session, restaurant_id: int, data: MenuCreateRequest) -> MenuResponse:
    try:
        menu = repository.create(db, restaurant_id, data)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Menu could not be saved because the restaurant context is invalid.",
        )
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Menu could not be saved. Please try again.",
        )
    return MenuResponse.model_validate(menu)


def update_menu(db: Session, menu_id: int, restaurant_id: int, data: MenuUpdateRequest) -> MenuResponse:
    try:
        menu = repository.update_by_id(db, menu_id, restaurant_id, data)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Menu could not be updated. Please try again.",
        )
    if not menu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu not found.")
    return MenuResponse.model_validate(menu)


def delete_menu(db: Session, menu_id: int, restaurant_id: int) -> dict:
    menu = repository.get_by_id(db, menu_id, restaurant_id)
    if not menu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu not found.")

    image_path = menu.image_path
    deleted = repository.delete_by_id(db, menu_id, restaurant_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu not found.")

    if image_path:
        delete_uploaded_file(upload_root=settings.upload_dir, public_path=image_path)

    return {"message": "Menu and its categories/items deleted.", "menu_id": menu_id}


async def upload_menu_image(
    db: Session,
    menu_id: int,
    restaurant_id: int,
    file: UploadFile,
) -> MenuImageUploadResponse:
    """Validate, save, and register a menu image.

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
        subdir="menus",
        allowed_content_types=_ALLOWED_CONTENT_TYPES,
        ext_map=_EXT_MAP,
        max_size_mb=settings.max_upload_size_mb,
    )
    try:
        menu = repository.update_image_path(db, menu_id, restaurant_id, image_path)
    except SQLAlchemyError:
        db.rollback()
        delete_uploaded_file(upload_root=settings.upload_dir, public_path=image_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Menu image could not be saved. Please try again.",
        )
    if not menu:
        delete_uploaded_file(upload_root=settings.upload_dir, public_path=image_path)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu not found.")

    return MenuImageUploadResponse(image_path=image_path)
