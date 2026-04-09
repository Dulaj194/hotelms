from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.modules.access import role_catalog
from app.modules.categories import service
from app.modules.categories.schemas import (
    CategoryCreateRequest,
    CategoryImageUploadResponse,
    CategoryResponse,
    CategoryUpdateRequest,
)
from app.modules.users.model import User

router = APIRouter()

_RESTAURANT_ADMIN_ROLES = role_catalog.RESTAURANT_ADMIN_ROLES


@router.get("", response_model=list[CategoryResponse])
def list_categories(
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> list[CategoryResponse]:
    return service.list_categories(db, current_user.restaurant_id)  # type: ignore[arg-type]


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def add_category(
    payload: CategoryCreateRequest,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> CategoryResponse:
    """SECURITY: restaurant_id comes from token, not payload."""
    if current_user.restaurant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return service.add_category(db, current_user.restaurant_id, payload)


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: int,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> CategoryResponse:
    return service.get_category(db, category_id, current_user.restaurant_id)  # type: ignore[arg-type]


@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    payload: CategoryUpdateRequest,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> CategoryResponse:
    return service.update_category(db, category_id, current_user.restaurant_id, payload)  # type: ignore[arg-type]


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> dict:
    return service.delete_category(db, category_id, current_user.restaurant_id)  # type: ignore[arg-type]


@router.post("/{category_id}/image", response_model=CategoryImageUploadResponse)
async def upload_category_image(
    category_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> CategoryImageUploadResponse:
    """Upload/replace category image. Owner/admin only.

    Multipart/form-data. Allowed: jpg, png, webp. Max: settings.max_upload_size_mb.
    SECURITY: filename is UUID-generated server-side; restaurant_id from token.
    """
    if current_user.restaurant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return await service.upload_category_image(
        db, category_id, current_user.restaurant_id, file
    )
