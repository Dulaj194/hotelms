from datetime import datetime

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
# SECURITY: StaffCreateRequest intentionally does not contain restaurant_id.
# The backend assigns restaurant_id from the authenticated context only.


_STAFF_ROLES = {
    UserRole.owner,
    UserRole.admin,
    UserRole.steward,
    UserRole.housekeeper,
}


class StaffCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: UserRole = Field(
        ...,
        description="Must be one of: owner, admin, steward, housekeeper",
    )
    restaurant_id: int | None = Field(
        default=None,
        description="Required for super_admin; ignored for owner/admin requests.",
    )


class StaffUpdateRequest(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=255)
    email: EmailStr | None = None
    password: str | None = Field(None, min_length=8, description="Leave blank to keep current")
    role: UserRole | None = None


class StaffListItemResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    is_active: bool
    last_login_at: datetime | None

    model_config = {"from_attributes": True}


class StaffDetailResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
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
