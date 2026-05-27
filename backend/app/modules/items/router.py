from typing import Any
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.core.pagination import PaginationParams, FilterParams, create_paginated_response, pagination_depends
from app.core.response_utils import success_response
from app.core.response_schemas import ApiResponse, PaginatedResponse
from app.modules.access import role_catalog
from app.modules.items import service
from app.modules.items.schemas import (
    ItemCreateRequest,
    ItemImageUploadResponse,
    ItemMediaUploadResponse,
    ItemResponse,
    ItemUpdateRequest,
)
from app.modules.users.model import User

router = APIRouter()

_RESTAURANT_ADMIN_ROLES = role_catalog.RESTAURANT_ADMIN_ROLES


def _require_items_restaurant_id(
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
) -> int:
    if current_user.restaurant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return current_user.restaurant_id


@router.get("", response_model=ApiResponse[Any])
def list_items(
    restaurant_id: int = Depends(_require_items_restaurant_id),
    pagination: PaginationParams = Depends(pagination_depends),
    filters: FilterParams = Depends(),
    category_id: int | None = Query(None, gt=0),
    db: Session = Depends(get_db),
) -> ApiResponse:
    """List items for restaurant with pagination."""
    items, total = service.list_items(
        db,
        restaurant_id,
        skip=pagination.skip,
        limit=pagination.limit,
        search=filters.search,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order.value if filters.sort_order else "asc",
        category_id=category_id,
    )
    paginated_data = create_paginated_response(items, total, pagination.page, pagination.limit)
    return success_response(data=paginated_data, message="Items listed successfully.")


@router.post("", response_model=ApiResponse[ItemResponse], status_code=status.HTTP_201_CREATED)
def add_item(
    payload: ItemCreateRequest,
    restaurant_id: int = Depends(_require_items_restaurant_id),
    db: Session = Depends(get_db),
) -> ApiResponse:
    """SECURITY: restaurant_id comes from token. category ownership verified server-side."""
    item = service.add_item(db, restaurant_id, payload)
    return success_response(data=item, message="Item created successfully.")


@router.get("/{item_id}", response_model=ApiResponse[ItemResponse])
def get_item(
    item_id: int,
    restaurant_id: int = Depends(_require_items_restaurant_id),
    db: Session = Depends(get_db),
) -> ApiResponse:
    item = service.get_item(db, item_id, restaurant_id)
    return success_response(data=item, message="Item retrieved successfully.")


@router.patch("/{item_id}", response_model=ApiResponse[ItemResponse])
def update_item(
    item_id: int,
    payload: ItemUpdateRequest,
    restaurant_id: int = Depends(_require_items_restaurant_id),
    db: Session = Depends(get_db),
) -> ApiResponse:
    item = service.update_item(db, item_id, restaurant_id, payload)
    return success_response(data=item, message="Item updated successfully.")


@router.delete("/{item_id}", response_model=ApiResponse[Any])
def delete_item(
    item_id: int,
    restaurant_id: int = Depends(_require_items_restaurant_id),
    db: Session = Depends(get_db),
) -> ApiResponse:
    result = service.delete_item(db, item_id, restaurant_id)
    return success_response(data=result, message="Item deleted successfully.")


@router.post("/{item_id}/image", response_model=ApiResponse[ItemImageUploadResponse])
async def upload_item_image(
    item_id: int,
    file: UploadFile = File(...),
    restaurant_id: int = Depends(_require_items_restaurant_id),
    db: Session = Depends(get_db),
) -> ApiResponse:
    """Upload/replace item image. Owner/admin only.

    Multipart/form-data. Allowed: jpg, png, webp. Max: settings.max_upload_size_mb.
    SECURITY: filename is UUID-generated server-side; restaurant_id from token.
    """
    result = await service.upload_item_image(db, item_id, restaurant_id, file)
    return success_response(data=result, message="Item image uploaded successfully.")


@router.post("/{item_id}/media/{slot}", response_model=ApiResponse[ItemMediaUploadResponse])
async def upload_item_media(
    item_id: int,
    slot: str,
    file: UploadFile = File(...),
    restaurant_id: int = Depends(_require_items_restaurant_id),
    db: Session = Depends(get_db),
) -> ApiResponse:
    result = await service.upload_item_media(db, item_id, restaurant_id, slot, file)
    return success_response(data=result, message="Item media uploaded successfully.")
