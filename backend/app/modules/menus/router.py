from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.modules.menus import service
from app.modules.menus.schemas import (
    MenuCreateRequest,
    MenuImageUploadResponse,
    MenuResponse,
    MenuUpdateRequest,
)
from app.modules.users.model import User

router = APIRouter()


@router.get("", response_model=list[MenuResponse])
def list_menus(
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> list[MenuResponse]:
    return service.list_menus(db, current_user.restaurant_id)  # type: ignore[arg-type]


@router.post("", response_model=MenuResponse, status_code=status.HTTP_201_CREATED)
def add_menu(
    payload: MenuCreateRequest,
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> MenuResponse:
    """SECURITY: restaurant_id comes from token, not payload."""
    if current_user.restaurant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return service.add_menu(db, current_user.restaurant_id, payload)


@router.get("/{menu_id}", response_model=MenuResponse)
def get_menu(
    menu_id: int,
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> MenuResponse:
    return service.get_menu(db, menu_id, current_user.restaurant_id)  # type: ignore[arg-type]


@router.patch("/{menu_id}", response_model=MenuResponse)
def update_menu(
    menu_id: int,
    payload: MenuUpdateRequest,
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> MenuResponse:
    return service.update_menu(db, menu_id, current_user.restaurant_id, payload)  # type: ignore[arg-type]


@router.delete("/{menu_id}")
def delete_menu(
    menu_id: int,
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> dict:
    return service.delete_menu(db, menu_id, current_user.restaurant_id)  # type: ignore[arg-type]


@router.post("/{menu_id}/image", response_model=MenuImageUploadResponse)
async def upload_menu_image(
    menu_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> MenuImageUploadResponse:
    """Upload/replace menu image. Owner/admin only.

    Multipart/form-data. Allowed: jpg, png, webp. Max: settings.max_upload_size_mb.
    SECURITY: filename is UUID-generated server-side; restaurant_id from token.
    """
    if current_user.restaurant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return await service.upload_menu_image(
        db, menu_id, current_user.restaurant_id, file
    )
