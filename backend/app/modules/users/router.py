from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_platform_scopes, require_roles
from app.modules.access import role_catalog
from app.modules.users import service
from app.modules.users.model import User
from app.modules.users.model import UserRole
from app.modules.users.schemas import (
    GenericMessageResponse,
    PlatformUserCreateRequest,
    PlatformUserDetailResponse,
    PlatformUserListResponse,
    PlatformUserUpdateRequest,
    StaffCreateRequest,
    StaffDetailResponse,
    StaffListItemResponse,
    StaffManagementPolicyResponse,
    StaffStatusResponse,
    StaffUpdateRequest,
)

router = APIRouter()

_RESTAURANT_ADMIN_ROLES = role_catalog.RESTAURANT_ADMIN_ROLES

# All staff management routes require owner or admin.
# restaurant_id is derived from current_user.restaurant_id (authenticated context)
# and never accepted from request body or query params.


@router.get("/platform", response_model=PlatformUserListResponse)
def list_platform_users(
    is_active: bool | None = Query(default=None),
    current_user: User = Depends(require_platform_scopes("security_admin")),
    db: Session = Depends(get_db),
) -> PlatformUserListResponse:
    return service.list_platform_users(db, is_active=is_active)


@router.post("/platform", response_model=PlatformUserDetailResponse, status_code=status.HTTP_201_CREATED)
def create_platform_user(
    payload: PlatformUserCreateRequest,
    current_user: User = Depends(require_platform_scopes("security_admin")),
    db: Session = Depends(get_db),
) -> PlatformUserDetailResponse:
    return service.create_platform_user(db, payload, current_user)


@router.get("/platform/{user_id}", response_model=PlatformUserDetailResponse)
def get_platform_user(
    user_id: int,
    current_user: User = Depends(require_platform_scopes("security_admin")),
    db: Session = Depends(get_db),
) -> PlatformUserDetailResponse:
    return service.get_platform_user(db, user_id)


@router.patch("/platform/{user_id}", response_model=PlatformUserDetailResponse)
def update_platform_user(
    user_id: int,
    payload: PlatformUserUpdateRequest,
    current_user: User = Depends(require_platform_scopes("security_admin")),
    db: Session = Depends(get_db),
) -> PlatformUserDetailResponse:
    return service.update_platform_user(db, user_id, payload, current_user)


@router.patch("/platform/{user_id}/disable", response_model=StaffStatusResponse)
def disable_platform_user(
    user_id: int,
    current_user: User = Depends(require_platform_scopes("security_admin")),
    db: Session = Depends(get_db),
) -> StaffStatusResponse:
    return service.disable_platform_user(db, user_id, current_user)


@router.patch("/platform/{user_id}/enable", response_model=StaffStatusResponse)
def enable_platform_user(
    user_id: int,
    current_user: User = Depends(require_platform_scopes("security_admin")),
    db: Session = Depends(get_db),
) -> StaffStatusResponse:
    return service.enable_platform_user(db, user_id, current_user)


@router.delete("/platform/{user_id}", response_model=GenericMessageResponse)
def delete_platform_user(
    user_id: int,
    current_user: User = Depends(require_platform_scopes("security_admin")),
    db: Session = Depends(get_db),
) -> GenericMessageResponse:
    return service.delete_platform_user(db, user_id, current_user)


@router.get("", response_model=list[StaffListItemResponse])
def list_staff(
    role: UserRole | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> list[StaffListItemResponse]:
    """List all staff for the current restaurant. Owner/admin only."""
    return service.list_staff_filtered(  # type: ignore[arg-type]
        db,
        current_user.restaurant_id,
        role=role,
        is_active=is_active,
    )


@router.get("/management-policy", response_model=StaffManagementPolicyResponse)
def get_staff_management_policy(
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
) -> StaffManagementPolicyResponse:
    return service.get_staff_management_policy(current_user)


@router.post("", response_model=StaffDetailResponse, status_code=status.HTTP_201_CREATED)
def add_staff(
    payload: StaffCreateRequest,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> StaffDetailResponse:
    """Add a new staff member to the current restaurant. Owner/admin only.

    SECURITY: restaurant_id comes from authenticated user context, not the request.
    StaffCreateRequest has no restaurant_id field.
    """
    return service.add_staff(db, current_user.restaurant_id, payload, current_user)  # type: ignore[arg-type]


@router.get("/{user_id}", response_model=StaffDetailResponse)
def get_staff(
    user_id: int,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> StaffDetailResponse:
    """Get a single staff member from the current restaurant."""
    return service.get_staff_member(db, user_id, current_user.restaurant_id)  # type: ignore[arg-type]


@router.patch("/{user_id}", response_model=StaffDetailResponse)
def update_staff(
    user_id: int,
    payload: StaffUpdateRequest,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> StaffDetailResponse:
    """Update a staff member in the current restaurant."""
    return service.update_staff(db, user_id, current_user.restaurant_id, payload, current_user)  # type: ignore[arg-type]


@router.patch("/{user_id}/disable", response_model=StaffStatusResponse)
def disable_staff(
    user_id: int,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> StaffStatusResponse:
    """Disable (deactivate) a staff member in the current restaurant."""
    return service.disable_staff(db, user_id, current_user.restaurant_id, current_user)  # type: ignore[arg-type]


@router.patch("/{user_id}/enable", response_model=StaffStatusResponse)
def enable_staff(
    user_id: int,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> StaffStatusResponse:
    """Re-enable a previously disabled staff member."""
    return service.enable_staff(db, user_id, current_user.restaurant_id, current_user)  # type: ignore[arg-type]


@router.delete("/{user_id}", response_model=GenericMessageResponse)
def delete_staff(
    user_id: int,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> GenericMessageResponse:
    """Permanently delete a staff member from the current restaurant."""
    return service.delete_staff(db, user_id, current_user.restaurant_id, current_user)  # type: ignore[arg-type]

