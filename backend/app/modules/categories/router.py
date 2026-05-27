from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.core.pagination import PaginationParams, create_paginated_response, pagination_depends
from app.core.response_utils import success_response
from app.core.response_schemas import ApiResponse, PaginatedResponse
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


def _require_categories_restaurant_id(
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
) -> int:
    if current_user.restaurant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return current_user.restaurant_id


@router.get("", response_model=ApiResponse[Any])
def list_categories(
    restaurant_id: int = Depends(_require_categories_restaurant_id),
    pagination: PaginationParams = Depends(pagination_depends),
    menu_id: int | None = Query(None, gt=0),
    db: Session = Depends(get_db),
) -> ApiResponse:
    """List categories for restaurant with pagination."""
    categories, total = service.list_categories(
        db,
        restaurant_id,
        skip=pagination.skip,
        limit=pagination.limit,
        menu_id=menu_id,
    )
    paginated_data = create_paginated_response(categories, total, pagination.page, pagination.limit)
    return success_response(data=paginated_data, message="Categories listed successfully.")


@router.post("", response_model=ApiResponse[CategoryResponse], status_code=status.HTTP_201_CREATED)
def add_category(
    payload: CategoryCreateRequest,
    restaurant_id: int = Depends(_require_categories_restaurant_id),
    db: Session = Depends(get_db),
) -> ApiResponse:
    """SECURITY: restaurant_id comes from token, not payload."""
    category = service.add_category(db, restaurant_id, payload)
    return success_response(data=category, message="Category created successfully.")


@router.get("/{category_id}", response_model=ApiResponse[CategoryResponse])
def get_category(
    category_id: int,
    restaurant_id: int = Depends(_require_categories_restaurant_id),
    db: Session = Depends(get_db),
) -> ApiResponse:
    category = service.get_category(db, category_id, restaurant_id)
    return success_response(data=category, message="Category retrieved successfully.")


@router.patch("/{category_id}", response_model=ApiResponse[CategoryResponse])
def update_category(
    category_id: int,
    payload: CategoryUpdateRequest,
    restaurant_id: int = Depends(_require_categories_restaurant_id),
    db: Session = Depends(get_db),
) -> ApiResponse:
    category = service.update_category(db, category_id, restaurant_id, payload)
    return success_response(data=category, message="Category updated successfully.")


@router.delete("/{category_id}", response_model=ApiResponse[Any])
def delete_category(
    category_id: int,
    restaurant_id: int = Depends(_require_categories_restaurant_id),
    db: Session = Depends(get_db),
) -> ApiResponse:
    result = service.delete_category(db, category_id, restaurant_id)
    return success_response(data=result, message="Category deleted successfully.")


@router.post("/{category_id}/media/{slot}", response_model=ApiResponse[CategoryImageUploadResponse])
async def upload_category_image(
    category_id: int,
    slot: str,
    file: UploadFile = File(...),
    restaurant_id: int = Depends(_require_categories_restaurant_id),
    db: Session = Depends(get_db),
) -> ApiResponse:
    result = await service.upload_category_image(db, category_id, restaurant_id, slot, file)
    return success_response(data=result, message="Category image uploaded successfully.")
