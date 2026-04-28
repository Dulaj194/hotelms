import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.file_storage import delete_uploaded_file
from app.modules.menus import repository
from app.modules.menus.schemas import (
    MenuCreateRequest,
    MenuImageUploadResponse,
    MenuResponse,
    MenuUpdateRequest,
)

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_EXT_MAP = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def list_menus(db: Session, restaurant_id: int) -> list[MenuResponse]:
    menus = repository.list_by_restaurant(db, restaurant_id)
    return [MenuResponse.model_validate(m) for m in menus]


def get_menu(db: Session, menu_id: int, restaurant_id: int) -> MenuResponse:
    menu = repository.get_by_id(db, menu_id, restaurant_id)
    if not menu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu not found.")
    return MenuResponse.model_validate(menu)


def add_menu(db: Session, restaurant_id: int, data: MenuCreateRequest) -> MenuResponse:
    menu = repository.create(db, restaurant_id, data)
    return MenuResponse.model_validate(menu)


def update_menu(db: Session, menu_id: int, restaurant_id: int, data: MenuUpdateRequest) -> MenuResponse:
    menu = repository.update_by_id(db, menu_id, restaurant_id, data)
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

    content = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {settings.max_upload_size_mb} MB size limit.",
        )

    ext = _EXT_MAP[file.content_type]  # type: ignore[index]
    filename = f"{uuid.uuid4().hex}{ext}"
    upload_path = Path(settings.upload_dir) / "menus"
    upload_path.mkdir(parents=True, exist_ok=True)
    (upload_path / filename).write_bytes(content)

    image_path = f"/uploads/menus/{filename}"
    menu = repository.update_image_path(db, menu_id, restaurant_id, image_path)
    if not menu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu not found.")

    return MenuImageUploadResponse(image_path=image_path)
