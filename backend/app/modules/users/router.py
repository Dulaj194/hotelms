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
from app.core.response_schemas import ApiResponse
from app.core.response_utils import success_response
from app.core.pagination import PaginationParams, pagination_depends, create_paginated_response

router = APIRouter()

_RESTAURANT_ADMIN_ROLES = role_catalog.RESTAURANT_ADMIN_ROLES

# All staff management routes require owner or admin.
# restaurant_id is derived from current_user.restaurant_id (authenticated context)
# and never accepted from request body or query params.


@router.get("/platform", response_model=ApiResponse)
def list_platform_users(
    pagination: PaginationParams = Depends(pagination_depends),
    is_active: bool | None = Query(default=None),
    current_user: User = Depends(require_platform_scopes("security_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    items, total = service.list_platform_users(
        db, 
        is_active=is_active,
        skip=pagination.skip,
        limit=pagination.limit
    )
    paginated_data = create_paginated_response(items, total, pagination.page, pagination.limit)
    return success_response(data=paginated_data, message="Platform users retrieved")


@router.post("/platform", response_model=ApiResponse[PlatformUserDetailResponse], status_code=status.HTTP_201_CREATED)
def create_platform_user(
    payload: PlatformUserCreateRequest,
    current_user: User = Depends(require_platform_scopes("security_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.create_platform_user(db, payload, current_user), message="Platform user created")


@router.get("/platform/{user_id}", response_model=ApiResponse[PlatformUserDetailResponse])
def get_platform_user(
    user_id: int,
    current_user: User = Depends(require_platform_scopes("security_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.get_platform_user(db, user_id), message="Platform user retrieved")


@router.patch("/platform/{user_id}", response_model=ApiResponse[PlatformUserDetailResponse])
def update_platform_user(
    user_id: int,
    payload: PlatformUserUpdateRequest,
    current_user: User = Depends(require_platform_scopes("security_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.update_platform_user(db, user_id, payload, current_user), message="Platform user updated")


@router.patch("/platform/{user_id}/disable", response_model=ApiResponse[StaffStatusResponse])
def disable_platform_user(
    user_id: int,
    current_user: User = Depends(require_platform_scopes("security_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.disable_platform_user(db, user_id, current_user), message="Platform user disabled")


@router.patch("/platform/{user_id}/enable", response_model=ApiResponse[StaffStatusResponse])
def enable_platform_user(
    user_id: int,
    current_user: User = Depends(require_platform_scopes("security_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.enable_platform_user(db, user_id, current_user), message="Platform user enabled")


@router.delete("/platform/{user_id}", response_model=ApiResponse[GenericMessageResponse])
def delete_platform_user(
    user_id: int,
    current_user: User = Depends(require_platform_scopes("security_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.delete_platform_user(db, user_id, current_user), message="Platform user deleted")


@router.get("", response_model=ApiResponse)
def list_staff(
    pagination: PaginationParams = Depends(pagination_depends),
    role: UserRole | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> ApiResponse:
    """List all staff for the current restaurant. Owner/admin only."""
    items, total = service.list_staff_filtered(  # type: ignore[arg-type]
        db,
        current_user.restaurant_id,
        role=role,
        is_active=is_active,
        skip=pagination.skip,
        limit=pagination.limit,
    )
    paginated_data = create_paginated_response(items, total, pagination.page, pagination.limit)
    return success_response(data=paginated_data, message="Staff listed successfully")


@router.get("/management-policy", response_model=ApiResponse[StaffManagementPolicyResponse])
def get_staff_management_policy(
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
) -> ApiResponse:
    return success_response(data=service.get_staff_management_policy(current_user), message="Policy retrieved")


@router.post("", response_model=ApiResponse[StaffDetailResponse], status_code=status.HTTP_201_CREATED)
def add_staff(
    payload: StaffCreateRequest,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> ApiResponse:
    """Add a new staff member to the current restaurant. Owner/admin only.

    SECURITY: restaurant_id comes from authenticated user context, not the request.
    StaffCreateRequest has no restaurant_id field.
    """
    return success_response(data=service.add_staff(db, current_user.restaurant_id, payload, current_user), message="Staff added")  # type: ignore[arg-type]


@router.get("/{user_id}", response_model=ApiResponse[StaffDetailResponse])
def get_staff(
    user_id: int,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> ApiResponse:
    """Get a single staff member from the current restaurant."""
    return success_response(data=service.get_staff_member(db, user_id, current_user.restaurant_id), message="Staff member retrieved")  # type: ignore[arg-type]


@router.patch("/{user_id}", response_model=ApiResponse[StaffDetailResponse])
def update_staff(
    user_id: int,
    payload: StaffUpdateRequest,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> ApiResponse:
    """Update a staff member in the current restaurant."""
    return success_response(data=service.update_staff(db, user_id, current_user.restaurant_id, payload, current_user), message="Staff updated")  # type: ignore[arg-type]


@router.patch("/{user_id}/disable", response_model=ApiResponse[StaffStatusResponse])
def disable_staff(
    user_id: int,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> ApiResponse:
    """Disable (deactivate) a staff member in the current restaurant."""
    return success_response(data=service.disable_staff(db, user_id, current_user.restaurant_id, current_user), message="Staff disabled")  # type: ignore[arg-type]


@router.patch("/{user_id}/enable", response_model=ApiResponse[StaffStatusResponse])
def enable_staff(
    user_id: int,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> ApiResponse:
    """Re-enable a previously disabled staff member."""
    return success_response(data=service.enable_staff(db, user_id, current_user.restaurant_id, current_user), message="Staff enabled")  # type: ignore[arg-type]


@router.delete("/{user_id}", response_model=ApiResponse[GenericMessageResponse])
def delete_staff(
    user_id: int,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> ApiResponse:
    """Permanently delete a staff member from the current restaurant."""
    return success_response(data=service.delete_staff(db, user_id, current_user.restaurant_id, current_user), message="Staff deleted")  # type: ignore[arg-type]

