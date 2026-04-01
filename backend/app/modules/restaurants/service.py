import uuid
from datetime import UTC, datetime
from pathlib import Path
import secrets
import string

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.notifications import send_onboarding_email
from app.modules.audit_logs.service import write_audit_log
from app.modules.reference_data import service as reference_data_service
from app.modules.restaurants import repository
from app.modules.subscriptions import service as subscription_service
from app.modules.restaurants.model import RegistrationStatus
from app.modules.users.model import UserRole
from app.modules.users.repository import create_staff, get_user_by_email, list_by_restaurant
from app.modules.users.schemas import StaffCreateRequest
from app.modules.restaurants.schemas import (
    PendingRestaurantRegistrationListResponse,
    RestaurantAdminUpdateRequest,
    RestaurantCreateRequest,
    RestaurantDeleteResponse,
    RestaurantRegistrationHistoryListResponse,
    RestaurantLogoUploadResponse,
    RestaurantMeResponse,
    RestaurantRegistrationReviewRequest,
    RestaurantRegistrationReviewResponse,
    RestaurantRegistrationSummaryResponse,
    RestaurantUpdateRequest,
)

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_EXT_MAP = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def _effective_billing_email(
    *,
    primary_email: str | None,
    billing_email: str | None,
) -> str | None:
    return billing_email or primary_email or None


def _apply_billing_email_defaults(
    update_data: dict,
    *,
    existing_primary_email: str | None = None,
    existing_billing_email: str | None = None,
) -> dict:
    normalized = dict(update_data)
    next_primary_email = (
        str(normalized.get("email")) if normalized.get("email") else None
        if "email" in normalized
        else existing_primary_email
    )

    if "billing_email" in normalized:
        explicit_billing_email = (
            str(normalized.get("billing_email")) if normalized.get("billing_email") else None
        )
        normalized["billing_email"] = _effective_billing_email(
            primary_email=next_primary_email,
            billing_email=explicit_billing_email,
        )
        return normalized

    if existing_primary_email is None and existing_billing_email is None:
        if next_primary_email:
            normalized["billing_email"] = next_primary_email
        return normalized

    if "email" in normalized:
        current_effective_billing = _effective_billing_email(
            primary_email=existing_primary_email,
            billing_email=existing_billing_email,
        )
        if current_effective_billing == existing_primary_email:
            normalized["billing_email"] = next_primary_email

    return normalized


def _build_profile_update_data(
    db: Session,
    payload: RestaurantUpdateRequest | RestaurantCreateRequest | RestaurantAdminUpdateRequest,
    *,
    existing_primary_email: str | None = None,
    existing_billing_email: str | None = None,
) -> dict:
    normalized_payload = _with_normalized_reference_fields(db, payload)
    update_data = normalized_payload.model_dump(exclude_unset=True)
    return _apply_billing_email_defaults(
        update_data,
        existing_primary_email=existing_primary_email,
        existing_billing_email=existing_billing_email,
    )


def _serialize_restaurant(restaurant) -> RestaurantMeResponse:
    response = RestaurantMeResponse.model_validate(restaurant)
    return response.model_copy(
        update={
            "billing_email": _effective_billing_email(
                primary_email=response.email,
                billing_email=response.billing_email,
            )
        }
    )


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
    return _serialize_restaurant(restaurant)


def update_my_restaurant(
    db: Session,
    restaurant_id: int,
    payload: RestaurantUpdateRequest,
) -> RestaurantMeResponse:
    """Update the authenticated tenant's restaurant profile."""
    current_restaurant = repository.get_by_id(db, restaurant_id)
    if current_restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    update_data = _build_profile_update_data(
        db,
        payload,
        existing_primary_email=current_restaurant.email,
        existing_billing_email=current_restaurant.billing_email,
    )
    restaurant = repository.update_profile(db, restaurant_id, update_data)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    return _serialize_restaurant(restaurant)


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
    return _serialize_restaurant(restaurant)


def list_all_restaurants(db: Session) -> list[RestaurantMeResponse]:
    """List all restaurants. Restricted to super_admin use only."""
    restaurants = repository.list_all_for_super_admin(db)
    return [_serialize_restaurant(r) for r in restaurants]


def list_pending_restaurant_registrations(
    db: Session,
    *,
    limit: int = 100,
) -> PendingRestaurantRegistrationListResponse:
    total = repository.count_by_registration_status(db, RegistrationStatus.PENDING)
    restaurants = repository.list_by_registration_status(
        db,
        RegistrationStatus.PENDING,
        limit=limit,
    )
    items = [
        _serialize_registration_summary_with_db(db, restaurant)
        for restaurant in restaurants
    ]
    return PendingRestaurantRegistrationListResponse(items=items, total=total)


def list_restaurant_registration_history(
    db: Session,
    *,
    registration_status: RegistrationStatus | None,
    limit: int = 100,
) -> RestaurantRegistrationHistoryListResponse:
    total = repository.count_reviewed_registrations(
        db,
        registration_status=registration_status,
    )
    restaurants = repository.list_reviewed_registrations(
        db,
        registration_status=registration_status,
        limit=limit,
    )
    items = [
        _serialize_registration_summary_with_db(db, restaurant)
        for restaurant in restaurants
    ]
    return RestaurantRegistrationHistoryListResponse(items=items, total=total)


def create_restaurant(db: Session, payload: RestaurantCreateRequest) -> RestaurantMeResponse:
    """Create a new restaurant tenant. Restricted to super_admin use only."""
    if payload.email and get_user_by_email(db, str(payload.email)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this restaurant email already exists.",
        )

    create_data = _build_profile_update_data(db, payload)

    restaurant = repository.create_restaurant(
        db,
        name=str(create_data["name"]),
        email=str(create_data["email"]) if create_data.get("email") else None,
        phone=str(create_data["phone"]) if create_data.get("phone") else None,
        address=str(create_data["address"]) if create_data.get("address") else None,
        country_id=create_data.get("country_id"),
        currency_id=create_data.get("currency_id"),
        country=str(create_data["country"]) if create_data.get("country") else None,
        currency=str(create_data["currency"]) if create_data.get("currency") else None,
        billing_email=str(create_data["billing_email"]) if create_data.get("billing_email") else None,
        opening_time=str(create_data["opening_time"]) if create_data.get("opening_time") else None,
        closing_time=str(create_data["closing_time"]) if create_data.get("closing_time") else None,
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

    return _serialize_restaurant(restaurant)


def update_restaurant_for_super_admin(
    db: Session,
    restaurant_id: int,
    payload: RestaurantAdminUpdateRequest,
) -> RestaurantMeResponse:
    """Update any restaurant by ID. Restricted to super_admin use only."""
    current_restaurant = repository.get_by_id_for_super_admin(db, restaurant_id)
    if current_restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    update_data = _build_profile_update_data(
        db,
        payload,
        existing_primary_email=current_restaurant.email,
        existing_billing_email=current_restaurant.billing_email,
    )
    restaurant = repository.update_for_super_admin(db, restaurant_id, update_data)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    return _serialize_restaurant(restaurant)


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


def review_restaurant_registration(
    db: Session,
    *,
    restaurant_id: int,
    reviewer_user_id: int,
    payload: RestaurantRegistrationReviewRequest,
) -> RestaurantRegistrationReviewResponse:
    restaurant = repository.get_by_id_for_super_admin(db, restaurant_id)
    if restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )

    if restaurant.registration_status != RegistrationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending registrations can be reviewed.",
        )

    restaurant.registration_reviewed_by_id = reviewer_user_id
    restaurant.registration_review_notes = payload.review_notes
    restaurant.registration_reviewed_at = datetime.now(UTC)

    users = list_by_restaurant(db, restaurant.id)

    if payload.status == RegistrationStatus.APPROVED.value:
        restaurant.registration_status = RegistrationStatus.APPROVED
        restaurant.is_active = True
        for user in users:
            user.is_active = True
        subscription_service.assign_initial_trial_subscription(
            db,
            restaurant.id,
            commit=False,
        )
        message = "Registration approved. Trial subscription activated."
        audit_event = "restaurant_registration_approved"
    else:
        restaurant.registration_status = RegistrationStatus.REJECTED
        restaurant.is_active = False
        for user in users:
            user.is_active = False
        message = "Registration rejected."
        audit_event = "restaurant_registration_rejected"

    db.commit()
    db.refresh(restaurant)

    write_audit_log(
        db,
        event_type=audit_event,
        user_id=reviewer_user_id,
        metadata={
            "restaurant_id": restaurant.id,
            "review_notes": payload.review_notes,
        },
    )

    return RestaurantRegistrationReviewResponse(
        message=message,
        registration=_serialize_registration_summary_with_db(db, restaurant),
    )


def _generate_temporary_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "@#$%!"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _serialize_registration_summary_with_db(
    db: Session,
    restaurant,
) -> RestaurantRegistrationSummaryResponse:
    owner = repository.get_owner_user(db, restaurant.id)
    return RestaurantRegistrationSummaryResponse(
        restaurant_id=restaurant.id,
        name=restaurant.name,
        owner_user_id=owner.id if owner else None,
        owner_full_name=owner.full_name if owner else None,
        owner_email=owner.email if owner else restaurant.email,
        phone=restaurant.phone,
        address=restaurant.address,
        country=restaurant.country,
        currency=restaurant.currency,
        billing_email=_effective_billing_email(
            primary_email=restaurant.email,
            billing_email=restaurant.billing_email,
        ),
        opening_time=restaurant.opening_time,
        closing_time=restaurant.closing_time,
        logo_url=restaurant.logo_url,
        created_at=restaurant.created_at,
        registration_status=restaurant.registration_status.value,
        registration_reviewed_by_id=restaurant.registration_reviewed_by_id,
        registration_review_notes=restaurant.registration_review_notes,
        registration_reviewed_at=restaurant.registration_reviewed_at,
    )


def _with_normalized_reference_fields(
    db: Session,
    payload: RestaurantUpdateRequest | RestaurantCreateRequest | RestaurantAdminUpdateRequest,
) -> RestaurantUpdateRequest | RestaurantCreateRequest | RestaurantAdminUpdateRequest:
    update_data = payload.model_dump(exclude_unset=True)

    if "country_id" in update_data:
        resolved_country_id, resolved_country_name = reference_data_service.resolve_country_from_id_or_name(
            db,
            country_id=update_data.get("country_id"),
            country_name=None,
        )
        update_data["country_id"] = resolved_country_id
        update_data["country"] = resolved_country_name
    elif "country" in update_data:
        resolved_country_id, resolved_country_name = reference_data_service.resolve_country_from_id_or_name(
            db,
            country_id=None,
            country_name=update_data.get("country"),
        )
        update_data["country_id"] = resolved_country_id
        update_data["country"] = resolved_country_name

    if "currency_id" in update_data:
        resolved_currency_id, resolved_currency_code = reference_data_service.resolve_currency_from_id_or_value(
            db,
            currency_id=update_data.get("currency_id"),
            currency_value=None,
        )
        update_data["currency_id"] = resolved_currency_id
        update_data["currency"] = resolved_currency_code
    elif "currency" in update_data:
        resolved_currency_id, resolved_currency_code = reference_data_service.resolve_currency_from_id_or_value(
            db,
            currency_id=None,
            currency_value=update_data.get("currency"),
        )
        update_data["currency_id"] = resolved_currency_id
        update_data["currency"] = resolved_currency_code

    return payload.model_copy(update=update_data)
