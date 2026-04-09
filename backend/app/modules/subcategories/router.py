from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.modules.access import role_catalog
from app.modules.subcategories import service
from app.modules.subcategories.schemas import (
    SubcategoryCreateRequest,
    SubcategoryImageUploadResponse,
    SubcategoryResponse,
    SubcategoryUpdateRequest,
)
from app.modules.users.model import User

router = APIRouter()

_RESTAURANT_ADMIN_ROLES = role_catalog.RESTAURANT_ADMIN_ROLES


@router.get("", response_model=list[SubcategoryResponse])
def list_subcategories(
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> list[SubcategoryResponse]:
    return service.list_subcategories(db, current_user.restaurant_id)  # type: ignore[arg-type]


@router.post("", response_model=SubcategoryResponse, status_code=status.HTTP_201_CREATED)
def add_subcategory(
    payload: SubcategoryCreateRequest,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> SubcategoryResponse:
    """SECURITY: restaurant_id comes from token. category ownership verified server-side."""
    if current_user.restaurant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return service.add_subcategory(db, current_user.restaurant_id, payload)


@router.get("/{subcategory_id}", response_model=SubcategoryResponse)
def get_subcategory(
    subcategory_id: int,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> SubcategoryResponse:
    return service.get_subcategory(db, subcategory_id, current_user.restaurant_id)  # type: ignore[arg-type]


@router.patch("/{subcategory_id}", response_model=SubcategoryResponse)
def update_subcategory(
    subcategory_id: int,
    payload: SubcategoryUpdateRequest,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> SubcategoryResponse:
    return service.update_subcategory(db, subcategory_id, current_user.restaurant_id, payload)  # type: ignore[arg-type]


@router.delete("/{subcategory_id}")
def delete_subcategory(
    subcategory_id: int,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> dict:
    return service.delete_subcategory(db, subcategory_id, current_user.restaurant_id)  # type: ignore[arg-type]


@router.post("/{subcategory_id}/image", response_model=SubcategoryImageUploadResponse)
async def upload_subcategory_image(
    subcategory_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> SubcategoryImageUploadResponse:
    """Upload/replace subcategory image. Owner/admin only.

    Multipart/form-data. Allowed: jpg, png, webp. Max: settings.max_upload_size_mb.
    SECURITY: filename is UUID-generated server-side; restaurant_id from token.
    """
    if current_user.restaurant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return await service.upload_subcategory_image(
        db, subcategory_id, current_user.restaurant_id, file
    )
