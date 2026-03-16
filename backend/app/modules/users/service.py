from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.audit_logs.service import write_audit_log
from app.modules.restaurants import repository as restaurant_repository
from app.modules.users.model import User, UserRole
from app.modules.users.repository import (
    count_active_owners,
    create_staff,
    create_user as repo_create_user,
    delete_by_id,
    disable_by_id,
    enable_by_id,
    get_by_id,
    get_by_id_global,
    get_user_by_email,
    list_by_restaurant,
    update_by_id,
)
from app.modules.users.schemas import (
    GenericMessageResponse,
    StaffCreateRequest,
    StaffDetailResponse,
    StaffListItemResponse,
    StaffStatusResponse,
    StaffUpdateRequest,
    UserCreate,
    UserResponse,
)

# ─── Role hierarchy ───────────────────────────────────────────────────────────
#
# Defines which roles a given manager role is allowed to create / modify.
# owner  → can manage admin, steward, housekeeper
# admin  → can manage steward, housekeeper
# steward / housekeeper → no management rights (enforced at router level too)

_MANAGEABLE_ROLES: dict[str, set[UserRole]] = {
    "super_admin": {UserRole.owner, UserRole.admin, UserRole.steward, UserRole.housekeeper},
    "owner": {UserRole.admin, UserRole.steward, UserRole.housekeeper},
    "admin": {UserRole.steward, UserRole.housekeeper},
}


def _assert_can_manage_role(manager: User, target_role: UserRole) -> None:
    """Raise 403 if the manager's role cannot manage the target role."""
    allowed = _MANAGEABLE_ROLES.get(manager.role.value, set())
    if target_role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your role '{manager.role.value}' cannot manage '{target_role.value}' users.",
        )


# ─── Internal helpers ─────────────────────────────────────────────────────────


def get_user(db: Session, user_id: int) -> User | None:
    """Global lookup — for super_admin or internal references only."""
    return get_by_id_global(db, user_id)


def create_user(db: Session, data: UserCreate) -> UserResponse:
    user = repo_create_user(db, data)
    return UserResponse.model_validate(user)


# ─── Staff list ───────────────────────────────────────────────────────────────


def list_staff(db: Session, restaurant_id: int) -> list[StaffListItemResponse]:
    """List all staff for the current tenant restaurant."""
    users = list_by_restaurant(db, restaurant_id)
    return [StaffListItemResponse.model_validate(u) for u in users]


# ─── Staff CRUD ───────────────────────────────────────────────────────────────


def get_staff_member(
    db: Session, user_id: int, restaurant_id: int
) -> StaffDetailResponse:
    user = get_by_id(db, user_id, restaurant_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found.",
        )
    return StaffDetailResponse.model_validate(user)


def add_staff(
    db: Session,
    restaurant_id: int | None,
    data: StaffCreateRequest,
    current_user: User,
) -> StaffDetailResponse:
    """Create a new staff member under the current restaurant.

    SECURITY: restaurant_id comes from authenticated context exclusively.
    StaffCreateRequest has no restaurant_id field.
    super_admin has restaurant_id=None — platform-level users will also get None.
    """
    _assert_can_manage_role(current_user, data.role)

    target_restaurant_id = restaurant_id
    if current_user.role == UserRole.super_admin:
        if data.restaurant_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="restaurant_id is required when super_admin creates staff.",
            )
        target_restaurant = restaurant_repository.get_by_id(db, data.restaurant_id)
        if target_restaurant is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target restaurant not found.",
            )
        target_restaurant_id = data.restaurant_id
    elif target_restaurant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No restaurant context.",
        )

    # Check email uniqueness globally (email is unique across all tenants)
    if get_user_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )

    require_password_change = current_user.role == UserRole.super_admin
    user = create_staff(
        db,
        target_restaurant_id,
        data,
        must_change_password=require_password_change,
    )

    write_audit_log(
        db,
        event_type="staff_created",
        user_id=current_user.id,
        metadata={
            "created_user_id": user.id,
            "role": data.role.value,
            "restaurant_id": target_restaurant_id,
            "must_change_password": require_password_change,
        },
    )

    return StaffDetailResponse.model_validate(user)


def update_staff(
    db: Session,
    user_id: int,
    restaurant_id: int,
    data: StaffUpdateRequest,
    current_user: User,
) -> StaffDetailResponse:
    # Validate that we can manage this user before touching them
    existing = get_by_id(db, user_id, restaurant_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found.",
        )

    _assert_can_manage_role(current_user, existing.role)

    # If role is being changed, validate the new role is manageable
    if data.role is not None:
        _assert_can_manage_role(current_user, data.role)

    # Email uniqueness: if changing email, ensure it's not taken
    if data.email and data.email != existing.email:
        if get_user_by_email(db, data.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists.",
            )

    updated = update_by_id(db, user_id, restaurant_id, data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found.")

    write_audit_log(
        db,
        event_type="staff_updated",
        user_id=current_user.id,
        metadata={"updated_user_id": user_id},
    )

    return StaffDetailResponse.model_validate(updated)


def disable_staff(
    db: Session,
    user_id: int,
    restaurant_id: int,
    current_user: User,
) -> StaffStatusResponse:
    # Cannot disable self
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot disable your own account.",
        )

    existing = get_by_id(db, user_id, restaurant_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found.")

    _assert_can_manage_role(current_user, existing.role)

    # Prevent disabling the last active owner
    if existing.role == UserRole.owner and count_active_owners(db, restaurant_id) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot disable the last active owner of the restaurant.",
        )

    user = disable_by_id(db, user_id, restaurant_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found.")

    write_audit_log(
        db,
        event_type="staff_disabled",
        user_id=current_user.id,
        metadata={"disabled_user_id": user_id},
    )

    return StaffStatusResponse(id=user.id, is_active=False, message="Staff member disabled.")


def enable_staff(
    db: Session,
    user_id: int,
    restaurant_id: int,
    current_user: User,
) -> StaffStatusResponse:
    existing = get_by_id(db, user_id, restaurant_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found.")

    _assert_can_manage_role(current_user, existing.role)

    user = enable_by_id(db, user_id, restaurant_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found.")

    return StaffStatusResponse(id=user.id, is_active=True, message="Staff member enabled.")


def delete_staff(
    db: Session,
    user_id: int,
    restaurant_id: int,
    current_user: User,
) -> GenericMessageResponse:
    # Cannot delete self
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account.",
        )

    existing = get_by_id(db, user_id, restaurant_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found.")

    _assert_can_manage_role(current_user, existing.role)

    # Prevent deleting the last active owner
    if existing.role == UserRole.owner and count_active_owners(db, restaurant_id) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the last active owner of the restaurant.",
        )

    deleted = delete_by_id(db, user_id, restaurant_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found.")

    write_audit_log(
        db,
        event_type="staff_deleted",
        user_id=current_user.id,
        metadata={"deleted_user_id": user_id},
    )

    return GenericMessageResponse(message="Staff member deleted successfully.")
