from pydantic import BaseModel, EmailStr, Field

from app.modules.users.model import UserRole


class UserCreate(BaseModel):
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
