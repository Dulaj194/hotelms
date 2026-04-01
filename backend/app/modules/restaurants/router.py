from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_restaurant_user, require_roles
from app.modules.restaurants import service
from app.modules.restaurants.model import RegistrationStatus
from app.modules.restaurants.schemas import (
    PendingRestaurantRegistrationListResponse,
    RestaurantApiKeyProvisionResponse,
    RestaurantApiKeySummaryResponse,
    RestaurantAdminUpdateRequest,
    RestaurantCreateRequest,
    RestaurantDeleteResponse,
    RestaurantIntegrationResponse,
    RestaurantIntegrationUpdateRequest,
    RestaurantLogoUploadResponse,
    RestaurantMeResponse,
    RestaurantRegistrationHistoryListResponse,
    RestaurantRegistrationReviewRequest,
    RestaurantRegistrationReviewResponse,
    RestaurantUpdateRequest,
    RestaurantWebhookHealthRefreshResponse,
)
from app.modules.users import service as users_service
from app.modules.users.model import User
from app.modules.users.schemas import (
    GenericMessageResponse,
    StaffCreateRequest,
    StaffDetailResponse,
    StaffListItemResponse,
    StaffStatusResponse,
)

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


@router.get(
    "/registrations/pending",
    response_model=PendingRestaurantRegistrationListResponse,
)
def list_pending_registrations(
    limit: int = 100,
    _current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> PendingRestaurantRegistrationListResponse:
    return service.list_pending_restaurant_registrations(db, limit=limit)


@router.get(
    "/registrations/history",
    response_model=RestaurantRegistrationHistoryListResponse,
)
def list_registration_history(
    limit: int = 100,
    status_filter: str | None = None,
    _current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> RestaurantRegistrationHistoryListResponse:
    try:
        registration_status = (
            RegistrationStatus(status_filter.upper()) if status_filter else None
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="status_filter must be APPROVED or REJECTED.",
        ) from exc
    if registration_status == RegistrationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="History view only supports APPROVED or REJECTED statuses.",
        )
    return service.list_restaurant_registration_history(
        db,
        registration_status=registration_status,
        limit=limit,
    )


@router.post("", response_model=RestaurantMeResponse, status_code=status.HTTP_201_CREATED)
def create_restaurant(
    payload: RestaurantCreateRequest,
    current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> RestaurantMeResponse:
    """Create a new restaurant tenant. Super-admin only."""
    return service.create_restaurant(db, payload, current_user_id=current_user.id)


@router.get("/{restaurant_id}", response_model=RestaurantMeResponse)
def get_restaurant_by_id(
    restaurant_id: int,
    _current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> RestaurantMeResponse:
    """Fetch any restaurant by ID. Super-admin only."""
    return service.get_restaurant_for_super_admin(db, restaurant_id)


@router.patch("/{restaurant_id}", response_model=RestaurantMeResponse)
def update_restaurant_by_id(
    restaurant_id: int,
    payload: RestaurantAdminUpdateRequest,
    _current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> RestaurantMeResponse:
    """Update any restaurant by ID. Super-admin only."""
    return service.update_restaurant_for_super_admin(db, restaurant_id, payload)


@router.patch("/{restaurant_id}/integration", response_model=RestaurantIntegrationResponse)
def update_restaurant_integration(
    restaurant_id: int,
    payload: RestaurantIntegrationUpdateRequest,
    current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> RestaurantIntegrationResponse:
    return service.update_restaurant_integration_settings(
        db,
        restaurant_id=restaurant_id,
        payload=payload,
        current_user_id=current_user.id,
    )


@router.post(
    "/{restaurant_id}/integration/api-key/generate",
    response_model=RestaurantApiKeyProvisionResponse,
)
def generate_restaurant_api_key(
    restaurant_id: int,
    current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> RestaurantApiKeyProvisionResponse:
    return service.provision_restaurant_api_key(
        db,
        restaurant_id=restaurant_id,
        current_user_id=current_user.id,
        rotate=False,
    )


@router.post(
    "/{restaurant_id}/integration/api-key/rotate",
    response_model=RestaurantApiKeyProvisionResponse,
)
def rotate_restaurant_api_key(
    restaurant_id: int,
    current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> RestaurantApiKeyProvisionResponse:
    return service.provision_restaurant_api_key(
        db,
        restaurant_id=restaurant_id,
        current_user_id=current_user.id,
        rotate=True,
    )


@router.delete(
    "/{restaurant_id}/integration/api-key",
    response_model=RestaurantApiKeySummaryResponse,
)
def revoke_restaurant_api_key(
    restaurant_id: int,
    current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> RestaurantApiKeySummaryResponse:
    return service.revoke_restaurant_api_key(
        db,
        restaurant_id=restaurant_id,
        current_user_id=current_user.id,
    )


@router.post(
    "/{restaurant_id}/integration/webhook/refresh",
    response_model=RestaurantWebhookHealthRefreshResponse,
)
def refresh_restaurant_webhook_health(
    restaurant_id: int,
    current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> RestaurantWebhookHealthRefreshResponse:
    return service.refresh_restaurant_webhook_health(
        db,
        restaurant_id=restaurant_id,
        current_user_id=current_user.id,
    )


@router.delete("/{restaurant_id}", response_model=RestaurantDeleteResponse)
def delete_restaurant_by_id(
    restaurant_id: int,
    _current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> RestaurantDeleteResponse:
    """Delete any restaurant by ID. Super-admin only."""
    return service.delete_restaurant_for_super_admin(db, restaurant_id)


@router.patch(
    "/{restaurant_id}/registration/review",
    response_model=RestaurantRegistrationReviewResponse,
)
def review_restaurant_registration(
    restaurant_id: int,
    payload: RestaurantRegistrationReviewRequest,
    current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> RestaurantRegistrationReviewResponse:
    return service.review_restaurant_registration(
        db,
        restaurant_id=restaurant_id,
        reviewer_user_id=current_user.id,
        payload=payload,
    )


# ─── Super-admin: hotel logo ──────────────────────────────────────────────────


@router.post(
    "/{restaurant_id}/logo",
    response_model=RestaurantLogoUploadResponse,
)
async def upload_logo_for_restaurant(
    restaurant_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> RestaurantLogoUploadResponse:
    """Upload / replace the logo for any restaurant.  Super-admin only."""
    return await service.upload_logo(db, restaurant_id, file, current_user.id)


# ─── Super-admin: hotel staff management ─────────────────────────────────────


@router.get(
    "/{restaurant_id}/users",
    response_model=list[StaffListItemResponse],
)
def list_restaurant_staff(
    restaurant_id: int,
    _current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> list[StaffListItemResponse]:
    """List all staff for a specific hotel.  Super-admin only."""
    service.get_restaurant_for_super_admin(db, restaurant_id)  # 404 guard
    return users_service.list_staff(db, restaurant_id)


@router.post(
    "/{restaurant_id}/users",
    response_model=StaffDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_restaurant_staff(
    restaurant_id: int,
    payload: StaffCreateRequest,
    current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> StaffDetailResponse:
    """Add a staff member to a specific hotel.  Super-admin only.

    SECURITY: restaurant_id is taken from the URL path, not the payload.
    The payload's restaurant_id field is overridden with the path value.
    """
    payload_for_hotel = payload.model_copy(update={"restaurant_id": restaurant_id})
    return users_service.add_staff(db, None, payload_for_hotel, current_user)


@router.delete(
    "/{restaurant_id}/users/{user_id}",
    response_model=GenericMessageResponse,
)
def delete_restaurant_staff(
    restaurant_id: int,
    user_id: int,
    current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> GenericMessageResponse:
    """Permanently remove a staff member from a hotel.  Super-admin only."""
    return users_service.delete_staff(db, user_id, restaurant_id, current_user)


@router.patch(
    "/{restaurant_id}/users/{user_id}/disable",
    response_model=StaffStatusResponse,
)
def disable_restaurant_staff(
    restaurant_id: int,
    user_id: int,
    current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> StaffStatusResponse:
    """Deactivate a staff member in a hotel.  Super-admin only."""
    return users_service.disable_staff(db, user_id, restaurant_id, current_user)


@router.patch(
    "/{restaurant_id}/users/{user_id}/enable",
    response_model=StaffStatusResponse,
)
def enable_restaurant_staff(
    restaurant_id: int,
    user_id: int,
    current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> StaffStatusResponse:
    """Re-activate a staff member in a hotel.  Super-admin only."""
    return users_service.enable_staff(db, user_id, restaurant_id, current_user)
