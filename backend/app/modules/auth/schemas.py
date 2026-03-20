from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    must_change_password: bool = False


class UserMeResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    restaurant_id: int | None
    is_active: bool
    must_change_password: bool = False

    model_config = {"from_attributes": True}


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


class RegisterRestaurantResponse(BaseModel):
    message: str
    restaurant_id: int
    owner_email: EmailStr
