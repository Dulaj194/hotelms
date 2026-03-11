from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.modules.users import service
from app.modules.users.model import User
from app.modules.users.schemas import (
    GenericMessageResponse,
    StaffCreateRequest,
    StaffDetailResponse,
    StaffListItemResponse,
    StaffStatusResponse,
    StaffUpdateRequest,
)

router = APIRouter()

# All staff management routes require owner or admin.
# restaurant_id is derived from current_user.restaurant_id (authenticated context)
# and never accepted from request body or query params.


@router.get("", response_model=list[StaffListItemResponse])
def list_staff(
    current_user: User = Depends(require_roles("owner", "admin", "super_admin")),
    db: Session = Depends(get_db),
) -> list[StaffListItemResponse]:
    """List all staff for the current restaurant. Owner/admin/super_admin only."""
    return service.list_staff(db, current_user.restaurant_id)  # type: ignore[arg-type]


@router.post("", response_model=StaffDetailResponse, status_code=status.HTTP_201_CREATED)
def add_staff(
    payload: StaffCreateRequest,
    current_user: User = Depends(require_roles("owner", "admin", "super_admin")),
    db: Session = Depends(get_db),
) -> StaffDetailResponse:
    """Add a new staff member to the current restaurant. Owner/admin/super_admin only.

    SECURITY: restaurant_id comes from authenticated user context, not the request.
    StaffCreateRequest has no restaurant_id field.
    """
    return service.add_staff(db, current_user.restaurant_id, payload, current_user)  # type: ignore[arg-type]


@router.get("/{user_id}", response_model=StaffDetailResponse)
def get_staff(
    user_id: int,
    current_user: User = Depends(require_roles("owner", "admin", "super_admin")),
    db: Session = Depends(get_db),
) -> StaffDetailResponse:
    """Get a single staff member from the current restaurant."""
    return service.get_staff_member(db, user_id, current_user.restaurant_id)  # type: ignore[arg-type]


@router.patch("/{user_id}", response_model=StaffDetailResponse)
def update_staff(
    user_id: int,
    payload: StaffUpdateRequest,
    current_user: User = Depends(require_roles("owner", "admin", "super_admin")),
    db: Session = Depends(get_db),
) -> StaffDetailResponse:
    """Update a staff member in the current restaurant."""
    return service.update_staff(db, user_id, current_user.restaurant_id, payload, current_user)  # type: ignore[arg-type]


@router.patch("/{user_id}/disable", response_model=StaffStatusResponse)
def disable_staff(
    user_id: int,
    current_user: User = Depends(require_roles("owner", "admin", "super_admin")),
    db: Session = Depends(get_db),
) -> StaffStatusResponse:
    """Disable (deactivate) a staff member in the current restaurant."""
    return service.disable_staff(db, user_id, current_user.restaurant_id, current_user)  # type: ignore[arg-type]


@router.patch("/{user_id}/enable", response_model=StaffStatusResponse)
def enable_staff(
    user_id: int,
    current_user: User = Depends(require_roles("owner", "admin", "super_admin")),
    db: Session = Depends(get_db),
) -> StaffStatusResponse:
    """Re-enable a previously disabled staff member."""
    return service.enable_staff(db, user_id, current_user.restaurant_id, current_user)  # type: ignore[arg-type]


@router.delete("/{user_id}", response_model=GenericMessageResponse)
def delete_staff(
    user_id: int,
    current_user: User = Depends(require_roles("owner", "admin", "super_admin")),
    db: Session = Depends(get_db),
) -> GenericMessageResponse:
    """Permanently delete a staff member from the current restaurant."""
    return service.delete_staff(db, user_id, current_user.restaurant_id, current_user)  # type: ignore[arg-type]

