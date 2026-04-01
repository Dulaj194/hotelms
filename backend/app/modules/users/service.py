from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.audit_logs.service import write_audit_log
from app.modules.housekeeping.model import HousekeepingRequest
from app.modules.orders.model import OrderHeader, OrderStatus
from app.modules.restaurants import repository as restaurant_repository
from app.modules.users.model import User, UserRole
from app.modules.users.repository import (
    count_active_owners,
    count_active_platform_users,
    create_staff,
    create_platform_user as repo_create_platform_user,
    create_user as repo_create_user,
    delete_by_id,
    delete_platform_user as repo_delete_platform_user,
    disable_by_id,
    disable_platform_user as repo_disable_platform_user,
    enable_by_id,
    enable_platform_user as repo_enable_platform_user,
    get_by_id,
    get_by_id_global,
    get_user_by_email,
    get_user_by_phone,
    get_user_by_username,
    get_platform_user_by_id,
    list_by_restaurant,
    list_platform_users as repo_list_platform_users,
    update_platform_user as repo_update_platform_user,
    update_by_id,
)
from app.modules.users.schemas import (
    GenericMessageResponse,
    PlatformUserCreateRequest,
    PlatformUserDetailResponse,
    PlatformUserListItemResponse,
    PlatformUserListResponse,
    PlatformUserUpdateRequest,
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
    "super_admin": {
        UserRole.owner,
        UserRole.admin,
        UserRole.steward,
        UserRole.housekeeper,
        UserRole.cashier,
        UserRole.accountant,
    },
    "owner": {
        UserRole.admin,
        UserRole.steward,
        UserRole.housekeeper,
        UserRole.cashier,
        UserRole.accountant,
    },
    "admin": {
        UserRole.steward,
        UserRole.housekeeper,
        UserRole.cashier,
        UserRole.accountant,
    },
}

_DEFAULT_ASSIGNED_AREAS: dict[UserRole, str | None] = {
    UserRole.owner: None,
    UserRole.admin: None,
    UserRole.steward: "steward",
    UserRole.housekeeper: "housekeeping",
    UserRole.cashier: "cashier",
    UserRole.accountant: "accounting",
    UserRole.super_admin: None,
}

_ALLOWED_ASSIGNED_AREAS: dict[UserRole, set[str | None]] = {
    UserRole.owner: {None},
    UserRole.admin: {None},
    UserRole.steward: {None, "steward", "kitchen"},
    UserRole.housekeeper: {None, "housekeeping"},
    UserRole.cashier: {None, "cashier"},
    UserRole.accountant: {None, "accounting"},
    UserRole.super_admin: {None},
}


def _assert_can_manage_role(manager: User, target_role: UserRole) -> None:
    """Raise 403 if the manager's role cannot manage the target role."""
    allowed = _MANAGEABLE_ROLES.get(manager.role.value, set())
    if target_role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your role '{manager.role.value}' cannot manage '{target_role.value}' users.",
        )


def _normalize_assigned_area(
    *,
    role: UserRole,
    assigned_area: str | None,
) -> str | None:
    allowed_areas = _ALLOWED_ASSIGNED_AREAS.get(role, {None})
    if assigned_area not in allowed_areas:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"assigned_area '{assigned_area}' is not valid for the "
                f"'{role.value}' role."
            ),
        )
    return assigned_area if assigned_area is not None else _DEFAULT_ASSIGNED_AREAS.get(role)


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
    return list_staff_filtered(db, restaurant_id)


def list_staff_filtered(
    db: Session,
    restaurant_id: int,
    role: UserRole | None = None,
    is_active: bool | None = None,
) -> list[StaffListItemResponse]:
    users = list_by_restaurant(db, restaurant_id, role=role, is_active=is_active)

    pending_kitchen = int(
        db.query(func.count(OrderHeader.id))
        .filter(
            OrderHeader.restaurant_id == restaurant_id,
            OrderHeader.status.in_(
                [OrderStatus.pending, OrderStatus.confirmed, OrderStatus.processing]
            ),
        )
        .scalar()
        or 0
    )
    pending_housekeeping = int(
        db.query(func.count(HousekeepingRequest.id))
        .filter(
            HousekeepingRequest.restaurant_id == restaurant_id,
            HousekeepingRequest.status.notin_(["ready", "cancelled", "done"]),
        )
        .scalar()
        or 0
    )

    active_stewards = sum(1 for user in users if user.role == UserRole.steward and user.is_active)
    active_housekeepers = sum(
        1 for user in users if user.role == UserRole.housekeeper and user.is_active
    )

    result: list[StaffListItemResponse] = []
    for user in users:
        item = StaffListItemResponse.model_validate(user)
        if user.role == UserRole.steward:
            setattr(item, "pending_tasks_count", pending_kitchen)
            setattr(
                item,
                "load_per_staff",
                round(pending_kitchen / active_stewards, 2) if active_stewards else float(pending_kitchen),
            )
        elif user.role == UserRole.housekeeper:
            setattr(item, "pending_tasks_count", pending_housekeeping)
            setattr(
                item,
                "load_per_staff",
                round(pending_housekeeping / active_housekeepers, 2)
                if active_housekeepers
                else float(pending_housekeeping),
            )
        else:
            setattr(item, "pending_tasks_count", 0)
            setattr(item, "load_per_staff", 0.0)
        result.append(item)

    return result


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

    normalized_username = data.username.strip().lower() if data.username else None
    normalized_phone = data.phone.strip() if data.phone else None
    data.username = normalized_username
    data.phone = normalized_phone
    data.assigned_area = _normalize_assigned_area(
        role=data.role,
        assigned_area=data.assigned_area,
    )

    # Check email uniqueness globally (email is unique across all tenants)
    if get_user_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )

    if normalized_username and get_user_by_username(db, normalized_username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this username already exists.",
        )

    if normalized_phone and get_user_by_phone(db, normalized_phone):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this contact number already exists.",
        )

    require_password_change = True
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

    next_role = data.role or existing.role
    assigned_area_provided = "assigned_area" in data.model_fields_set
    candidate_assigned_area = (
        data.assigned_area
        if assigned_area_provided
        else existing.assigned_area if data.role is None else None
    )
    normalized_assigned_area = _normalize_assigned_area(
        role=next_role,
        assigned_area=candidate_assigned_area,
    )
    if assigned_area_provided or data.role is not None:
        data.assigned_area = normalized_assigned_area

    # Email uniqueness: if changing email, ensure it's not taken
    if data.email and data.email != existing.email:
        if get_user_by_email(db, data.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists.",
            )

    if data.username is not None:
        normalized_username = data.username.strip().lower()
        if normalized_username != (existing.username or ""):
            if get_user_by_username(db, normalized_username):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A user with this username already exists.",
                )
        data.username = normalized_username

    if data.phone is not None:
        normalized_phone = data.phone.strip()
        if normalized_phone != (existing.phone or ""):
            if get_user_by_phone(db, normalized_phone):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A user with this contact number already exists.",
                )
        data.phone = normalized_phone

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

    write_audit_log(
        db,
        event_type="staff_enabled",
        user_id=current_user.id,
        metadata={"enabled_user_id": user_id},
    )

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

    if existing.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deactivate the staff account before deleting it.",
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


def list_platform_users(
    db: Session,
    *,
    is_active: bool | None = None,
) -> PlatformUserListResponse:
    users = repo_list_platform_users(db, is_active=is_active)
    return PlatformUserListResponse(
        items=[PlatformUserListItemResponse.model_validate(user) for user in users],
        total=len(users),
    )


def get_platform_user(
    db: Session,
    user_id: int,
) -> PlatformUserDetailResponse:
    user = get_platform_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Platform user not found.",
        )
    return PlatformUserDetailResponse.model_validate(user)


def create_platform_user(
    db: Session,
    data: PlatformUserCreateRequest,
    current_user: User,
) -> PlatformUserDetailResponse:
    normalized_username = data.username.strip().lower() if data.username else None
    normalized_phone = data.phone.strip() if data.phone else None

    if get_user_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )
    if normalized_username and get_user_by_username(db, normalized_username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this username already exists.",
        )
    if normalized_phone and get_user_by_phone(db, normalized_phone):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this contact number already exists.",
        )

    user = repo_create_platform_user(
        db,
        full_name=data.full_name,
        email=str(data.email),
        username=normalized_username,
        phone=normalized_phone,
        password=data.password,
        is_active=data.is_active,
        must_change_password=data.must_change_password,
    )

    write_audit_log(
        db,
        event_type="platform_user_created",
        user_id=current_user.id,
        metadata={"created_user_id": user.id},
    )
    return PlatformUserDetailResponse.model_validate(user)


def update_platform_user(
    db: Session,
    user_id: int,
    data: PlatformUserUpdateRequest,
    current_user: User,
) -> PlatformUserDetailResponse:
    user = get_platform_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Platform user not found.",
        )

    update_data = data.model_dump(exclude_unset=True)
    if "email" in update_data and update_data["email"] != user.email:
        if get_user_by_email(db, update_data["email"]):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists.",
            )
    if "username" in update_data:
        normalized_username = update_data["username"].strip().lower() if update_data["username"] else None
        if normalized_username != (user.username or None) and normalized_username and get_user_by_username(db, normalized_username):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this username already exists.",
            )
        update_data["username"] = normalized_username
    if "phone" in update_data:
        normalized_phone = update_data["phone"].strip() if update_data["phone"] else None
        if normalized_phone != (user.phone or None) and normalized_phone and get_user_by_phone(db, normalized_phone):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this contact number already exists.",
            )
        update_data["phone"] = normalized_phone

    if update_data.get("is_active") is False and user.is_active and count_active_platform_users(db) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate the last active super admin account.",
        )

    updated = repo_update_platform_user(db, user, update_data)
    write_audit_log(
        db,
        event_type="platform_user_updated",
        user_id=current_user.id,
        metadata={"updated_user_id": user_id},
    )
    return PlatformUserDetailResponse.model_validate(updated)


def disable_platform_user(
    db: Session,
    user_id: int,
    current_user: User,
) -> StaffStatusResponse:
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot disable your own platform account.",
        )

    user = get_platform_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Platform user not found.",
        )
    if user.is_active and count_active_platform_users(db) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot disable the last active super admin account.",
        )

    updated = repo_disable_platform_user(db, user)
    write_audit_log(
        db,
        event_type="platform_user_disabled",
        user_id=current_user.id,
        metadata={"disabled_user_id": user_id},
    )
    return StaffStatusResponse(
        id=updated.id,
        is_active=updated.is_active,
        message="Platform user disabled.",
    )


def enable_platform_user(
    db: Session,
    user_id: int,
    current_user: User,
) -> StaffStatusResponse:
    user = get_platform_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Platform user not found.",
        )

    updated = repo_enable_platform_user(db, user)
    write_audit_log(
        db,
        event_type="platform_user_enabled",
        user_id=current_user.id,
        metadata={"enabled_user_id": user_id},
    )
    return StaffStatusResponse(
        id=updated.id,
        is_active=updated.is_active,
        message="Platform user enabled.",
    )


def delete_platform_user(
    db: Session,
    user_id: int,
    current_user: User,
) -> GenericMessageResponse:
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own platform account.",
        )

    user = get_platform_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Platform user not found.",
        )
    if user.is_active and count_active_platform_users(db) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the last active super admin account.",
        )
    if user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deactivate the platform account before deleting it.",
        )

    repo_delete_platform_user(db, user)
    write_audit_log(
        db,
        event_type="platform_user_deleted",
        user_id=current_user.id,
        metadata={"deleted_user_id": user_id},
    )
    return GenericMessageResponse(message="Platform user deleted successfully.")
