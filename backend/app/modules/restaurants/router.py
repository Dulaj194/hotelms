from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_restaurant_user, require_roles
from app.modules.restaurants import service
from app.modules.restaurants.schemas import (
    RestaurantCreateRequest,
    RestaurantLogoUploadResponse,
    RestaurantMeResponse,
    RestaurantUpdateRequest,
)
from app.modules.users.model import User

router = APIRouter()


@router.get("/me", response_model=RestaurantMeResponse)
def get_my_restaurant(
    current_user: User = Depends(require_restaurant_user),
    db: Session = Depends(get_db),
) -> RestaurantMeResponse:
    """Return current tenant's restaurant profile.

    SECURITY: restaurant_id from authenticated user object only.
    """
    return service.get_my_restaurant(db, current_user.restaurant_id)  # type: ignore[arg-type]


@router.patch("/me", response_model=RestaurantMeResponse)
def update_my_restaurant(
    payload: RestaurantUpdateRequest,
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> RestaurantMeResponse:
    """Update current tenant's restaurant profile. Owner/admin only.

    SECURITY: restaurant_id from authenticated user, never from payload.
    """
    if current_user.restaurant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return service.update_my_restaurant(db, current_user.restaurant_id, payload)


@router.post("/me/logo", response_model=RestaurantLogoUploadResponse)
async def upload_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> RestaurantLogoUploadResponse:
    """Upload/replace the restaurant logo. Owner/admin only.

    Multipart/form-data. Allowed: jpg, jpeg, png, webp. Max: 5 MB.

    SECURITY: Original filename never used. UUID path assigned server-side.
    restaurant_id from authenticated user.
    """
    if current_user.restaurant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return await service.upload_logo(db, current_user.restaurant_id, file, current_user.id)


@router.get("", response_model=list[RestaurantMeResponse])
def list_restaurants(
    _current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> list[RestaurantMeResponse]:
    """List all restaurants. Super-admin only."""
    return service.list_all_restaurants(db)


@router.post("", response_model=RestaurantMeResponse, status_code=status.HTTP_201_CREATED)
def create_restaurant(
    payload: RestaurantCreateRequest,
    _current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> RestaurantMeResponse:
    """Create a new restaurant tenant. Super-admin only."""
    return service.create_restaurant(db, payload)


@router.get("/{restaurant_id}", response_model=RestaurantMeResponse)
def get_restaurant_by_id(
    restaurant_id: int,
    _current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> RestaurantMeResponse:
    """Fetch any restaurant by ID. Super-admin only."""
    return service.get_restaurant_for_super_admin(db, restaurant_id)
