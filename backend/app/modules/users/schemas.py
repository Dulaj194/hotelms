from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.modules.users.model import UserRole


# ─── Internal / auth-flow schemas ────────────────────────────────────────


class UserCreate(BaseModel):
    """Used for direct / seed user creation (includes restaurant_id)."""

    full_name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: UserRole
    restaurant_id: int | None = None


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    is_active: bool
    restaurant_id: int | None

    model_config = {"from_attributes": True}


# ─── Staff management schemas ─────────────────────────────────────────
#
# SECURITY:
# - Owner/admin routes must not send restaurant_id; backend derives tenant context
#   from the authenticated user.
# - Super-admin hotel-scoped routes may populate restaurant_id internally.


_STAFF_ROLES = {
    UserRole.owner,
    UserRole.admin,
    UserRole.steward,
    UserRole.housekeeper,
}

AssignedArea = Literal["kitchen", "housekeeping", "steward"]


class StaffCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    username: str | None = Field(None, min_length=3, max_length=64)
    phone: str | None = Field(None, min_length=7, max_length=32)
    password: str = Field(..., min_length=8)
    role: UserRole = Field(
        ...,
        description="Must be one of: owner, admin, steward, housekeeper",
    )
    assigned_area: AssignedArea | None = None
    is_active: bool = True
    restaurant_id: int | None = Field(
        default=None,
        description=(
            "Used by super_admin hotel-scoped flows; must be omitted for owner/admin "
            "tenant-scoped requests."
        ),
    )


class StaffUpdateRequest(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=255)
    email: EmailStr | None = None
    username: str | None = Field(None, min_length=3, max_length=64)
    phone: str | None = Field(None, min_length=7, max_length=32)
    password: str | None = Field(None, min_length=8, description="Leave blank to keep current")
    role: UserRole | None = None
    assigned_area: AssignedArea | None = None
    is_active: bool | None = None


class StaffListItemResponse(BaseModel):
    id: int
    full_name: str
    email: str
    username: str | None
    phone: str | None
    role: str
    assigned_area: str | None
    is_active: bool
    last_login_at: datetime | None
    pending_tasks_count: int = 0
    load_per_staff: float = 0.0

    model_config = {"from_attributes": True}


class StaffDetailResponse(BaseModel):
    id: int
    full_name: str
    email: str
    username: str | None
    phone: str | None
    role: str
    assigned_area: str | None
    is_active: bool
    restaurant_id: int | None
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None

    model_config = {"from_attributes": True}


class StaffStatusResponse(BaseModel):
    id: int
    is_active: bool
    message: str


class GenericMessageResponse(BaseModel):
    message: str
