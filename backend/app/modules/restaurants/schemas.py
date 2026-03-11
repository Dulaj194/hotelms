from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RestaurantResponse(BaseModel):
    id: int
    name: str
    email: str | None
    phone: str | None
    address: str | None
    logo_url: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# Alias used in /me endpoints for clarity in OpenAPI docs.
RestaurantMeResponse = RestaurantResponse


class RestaurantUpdateRequest(BaseModel):
    """Allowed fields for the tenant to update on their own restaurant profile.

    SECURITY: restaurant_id is intentionally absent.
    It must never be accepted from the client for tenant-scoped operations.
    The current restaurant is always derived from the authenticated token.
    """

    name: str | None = Field(None, min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=50)
    address: str | None = Field(None, max_length=500)


class RestaurantLogoUploadResponse(BaseModel):
    logo_url: str
    message: str = "Logo uploaded successfully."
