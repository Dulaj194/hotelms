import uuid
from pathlib import Path
import secrets
import string

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.notifications import send_onboarding_email
from app.modules.audit_logs.service import write_audit_log
from app.modules.restaurants import repository
from app.modules.subscriptions import service as subscription_service
from app.modules.users.model import UserRole
from app.modules.users.repository import create_staff, get_user_by_email
from app.modules.users.schemas import StaffCreateRequest
from app.modules.restaurants.schemas import (
    RestaurantAdminUpdateRequest,
    RestaurantCreateRequest,
    RestaurantDeleteResponse,
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
    if payload.email and get_user_by_email(db, str(payload.email)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this restaurant email already exists.",
        )

    restaurant = repository.create_restaurant(
        db,
        name=payload.name,
        email=str(payload.email) if payload.email else None,
        phone=payload.phone,
        address=payload.address,
        country=payload.country,
        currency=payload.currency,
        billing_email=str(payload.billing_email) if payload.billing_email else None,
        tax_id=payload.tax_id,
        opening_time=payload.opening_time,
        closing_time=payload.closing_time,
    )

    subscription_service.assign_initial_trial_subscription(db, restaurant.id)

    if restaurant.email:
        temporary_password = _generate_temporary_password()
        admin_user = create_staff(
            db,
            restaurant.id,
            StaffCreateRequest(
                full_name=f"{restaurant.name} Admin",
                email=restaurant.email,
                password=temporary_password,
                role=UserRole.admin,
                restaurant_id=restaurant.id,
            ),
            must_change_password=True,
        )

        sent = send_onboarding_email(
            recipient_email=admin_user.email,
            recipient_name=admin_user.full_name,
            restaurant_name=restaurant.name,
            temporary_password=temporary_password,
        )

        write_audit_log(
            db,
            event_type="restaurant_admin_onboarding_created",
            user_id=admin_user.id,
            metadata={
                "restaurant_id": restaurant.id,
                "email_sent": sent,
            },
        )

    return RestaurantMeResponse.model_validate(restaurant)


def update_restaurant_for_super_admin(
    db: Session,
    restaurant_id: int,
    payload: RestaurantAdminUpdateRequest,
) -> RestaurantMeResponse:
    """Update any restaurant by ID. Restricted to super_admin use only."""
    update_data = payload.model_dump(exclude_unset=True)
    restaurant = repository.update_for_super_admin(db, restaurant_id, update_data)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    return RestaurantMeResponse.model_validate(restaurant)


def delete_restaurant_for_super_admin(
    db: Session,
    restaurant_id: int,
) -> RestaurantDeleteResponse:
    """Delete any restaurant by ID. Restricted to super_admin use only."""
    try:
        deleted = repository.delete_for_super_admin(db, restaurant_id)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Restaurant cannot be deleted due to related records.",
        ) from exc

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )

    return RestaurantDeleteResponse(
        message="Restaurant deleted successfully.",
        restaurant_id=restaurant_id,
    )


def _generate_temporary_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "@#$%!"
    return "".join(secrets.choice(alphabet) for _ in range(length))
