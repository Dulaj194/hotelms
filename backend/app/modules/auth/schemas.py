import re

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.modules.users.model import UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    must_change_password: bool = False


class UserFeatureFlagResponse(BaseModel):
    steward: bool = False
    housekeeping: bool = False
    kds: bool = False
    reports: bool = False
    accountant: bool = False
    cashier: bool = False


class UserModuleAccessResponse(BaseModel):
    orders: bool = False
    qr: bool = False
    kds: bool = False
    steward_ops: bool = False
    reports: bool = False
    billing: bool = False
    housekeeping: bool = False
    offers: bool = False


class UserMeResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: UserRole
    restaurant_id: int | None
    is_active: bool
    must_change_password: bool = False
    package_id: int | None = None
    package_name: str | None = None
    package_code: str | None = None
    subscription_status: str | None = None
    privileges: list[str] = Field(default_factory=list)
    super_admin_scopes: list[str] = Field(default_factory=list)
    feature_flags: UserFeatureFlagResponse = Field(default_factory=UserFeatureFlagResponse)
    module_access: UserModuleAccessResponse = Field(default_factory=UserModuleAccessResponse)


class TenantDataCountsResponse(BaseModel):
    menus: int = 0
    categories: int = 0
    items: int = 0


class TenantContextResponse(BaseModel):
    user_id: int
    email: EmailStr
    role: UserRole
    restaurant_id: int | None
    restaurant_name: str | None = None
    counts: TenantDataCountsResponse
    note: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str
    dev_reset_token: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, description="Minimum 8 characters")


class InitialPasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)


class GenericMessageResponse(BaseModel):
    message: str


class RegisterRestaurantRequest(BaseModel):
    restaurant_name: str = Field(..., min_length=1, max_length=255)
    owner_full_name: str = Field(..., min_length=1, max_length=255)
    owner_email: EmailStr
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    confirm_password: str = Field(..., min_length=8)
    address: str = Field(..., min_length=1, max_length=500)
    contact_number: str = Field(..., pattern=r"^[0-9]{10}$")
    opening_time: str = Field(..., pattern=r"^([01][0-9]|2[0-3]):[0-5][0-9]$")
    closing_time: str = Field(..., pattern=r"^([01][0-9]|2[0-3]):[0-5][0-9]$")

    @field_validator("password")
    @classmethod
    def validate_password_policy(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters.")
        if not re.search(r"[A-Z]", value):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", value):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", value):
            raise ValueError("Password must contain at least one number.")
        return value


class RegisterRestaurantResponse(BaseModel):
    message: str
    message_key: str = "registration_pending_approval"
    restaurant_id: int
    owner_email: EmailStr
    correlation_id: str | None = None
