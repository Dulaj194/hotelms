import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.audit_logs.service import write_audit_log
from app.modules.restaurants import repository
from app.modules.subscriptions import service as subscription_service
from app.modules.restaurants.schemas import (
    RestaurantCreateRequest,
    RestaurantLogoUploadResponse,
    RestaurantMeResponse,
    RestaurantUpdateRequest,
)

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_EXT_MAP = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def get_my_restaurant(db: Session, restaurant_id: int) -> RestaurantMeResponse:
    """Return the authenticated tenant's restaurant profile.

    restaurant_id must come from the authenticated user context, never from a
    client-supplied value.
    """
    restaurant = repository.get_by_id(db, restaurant_id)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    return RestaurantMeResponse.model_validate(restaurant)


def update_my_restaurant(
    db: Session,
    restaurant_id: int,
    payload: RestaurantUpdateRequest,
) -> RestaurantMeResponse:
    """Update the authenticated tenant's restaurant profile."""
    restaurant = repository.update_profile(db, restaurant_id, payload)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    return RestaurantMeResponse.model_validate(restaurant)


async def upload_logo(
    db: Session,
    restaurant_id: int,
    file: UploadFile,
    current_user_id: int,
) -> RestaurantLogoUploadResponse:
    """Validate, save, and register a restaurant logo file.

    Security guarantees:
    - Content-type validated against an explicit allowlist.
    - Extension derived from content-type, NEVER from original filename.
    - UUID-based filename prevents directory traversal.
    - File size validated after read (files are <5 MB max).
    """
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{file.content_type}'. Allowed: jpg, jpeg, png, webp.",
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

    upload_path = Path(settings.upload_dir) / "logos"
    upload_path.mkdir(parents=True, exist_ok=True)
    (upload_path / filename).write_bytes(content)

    logo_url = f"/uploads/logos/{filename}"
    restaurant = repository.update_logo(db, restaurant_id, logo_url)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )

    write_audit_log(db, event_type="restaurant_logo_uploaded", user_id=current_user_id)

    return RestaurantLogoUploadResponse(logo_url=logo_url)


def get_restaurant_for_super_admin(
    db: Session, restaurant_id: int
) -> RestaurantMeResponse:
    """Fetch any restaurant by ID. Restricted to super_admin use only."""
    restaurant = repository.get_by_id_for_super_admin(db, restaurant_id)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    return RestaurantMeResponse.model_validate(restaurant)


def list_all_restaurants(db: Session) -> list[RestaurantMeResponse]:
    """List all restaurants. Restricted to super_admin use only."""
    restaurants = repository.list_all_for_super_admin(db)
    return [RestaurantMeResponse.model_validate(r) for r in restaurants]


def create_restaurant(db: Session, payload: RestaurantCreateRequest) -> RestaurantMeResponse:
    """Create a new restaurant tenant. Restricted to super_admin use only."""
    restaurant = repository.create_restaurant(
        db,
        name=payload.name,
        email=str(payload.email) if payload.email else None,
        phone=payload.phone,
        address=payload.address,
    )

    subscription_service.assign_initial_trial_subscription(db, restaurant.id)

    return RestaurantMeResponse.model_validate(restaurant)
