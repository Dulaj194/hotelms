from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

RegistrationStatusValue = Literal["PENDING", "APPROVED", "REJECTED"]


class RestaurantResponse(BaseModel):
    id: int
    name: str
    email: str | None
    phone: str | None
    address: str | None
    country_id: int | None
    currency_id: int | None
    country: str | None
    currency: str | None
    billing_email: str | None
    opening_time: str | None
    closing_time: str | None
    logo_url: str | None
    is_active: bool
    registration_status: RegistrationStatusValue
    registration_reviewed_by_id: int | None
    registration_review_notes: str | None
    registration_reviewed_at: datetime | None
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
    country_id: int | None = Field(None, ge=1)
    currency_id: int | None = Field(None, ge=1)
    country: str | None = Field(None, max_length=120)
    currency: str | None = Field(None, max_length=12)
    billing_email: EmailStr | None = None
    opening_time: str | None = Field(None, max_length=8)
    closing_time: str | None = Field(None, max_length=8)


class RestaurantCreateRequest(BaseModel):
    """Payload for super_admin to create a new restaurant tenant."""

    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=50)
    address: str | None = Field(None, max_length=500)
    country_id: int | None = Field(None, ge=1)
    currency_id: int | None = Field(None, ge=1)
    country: str | None = Field(None, max_length=120)
    currency: str | None = Field(None, max_length=12)
    billing_email: EmailStr | None = None
    opening_time: str | None = Field(None, max_length=8)
    closing_time: str | None = Field(None, max_length=8)


class RestaurantAdminUpdateRequest(BaseModel):
    """Payload for super_admin to update any restaurant tenant."""

    name: str | None = Field(None, min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=50)
    address: str | None = Field(None, max_length=500)
    country_id: int | None = Field(None, ge=1)
    currency_id: int | None = Field(None, ge=1)
    country: str | None = Field(None, max_length=120)
    currency: str | None = Field(None, max_length=12)
    billing_email: EmailStr | None = None
    opening_time: str | None = Field(None, max_length=8)
    closing_time: str | None = Field(None, max_length=8)
    is_active: bool | None = None


class RestaurantDeleteResponse(BaseModel):
    message: str
    restaurant_id: int


class RestaurantLogoUploadResponse(BaseModel):
    logo_url: str
    message: str = "Logo uploaded successfully."


class RestaurantRegistrationSummaryResponse(BaseModel):
    restaurant_id: int
    name: str
    owner_user_id: int | None
    owner_full_name: str | None
    owner_email: str | None
    phone: str | None
    address: str | None
    country: str | None
    currency: str | None
    billing_email: str | None
    opening_time: str | None
    closing_time: str | None
    logo_url: str | None
    created_at: datetime
    registration_status: RegistrationStatusValue
    registration_reviewed_by_id: int | None
    registration_review_notes: str | None
    registration_reviewed_at: datetime | None


class PendingRestaurantRegistrationListResponse(BaseModel):
    items: list[RestaurantRegistrationSummaryResponse]
    total: int


class RestaurantRegistrationHistoryListResponse(BaseModel):
    items: list[RestaurantRegistrationSummaryResponse]
    total: int


class RestaurantRegistrationReviewRequest(BaseModel):
    status: Literal["APPROVED", "REJECTED"]
    review_notes: str | None = Field(default=None, max_length=2000)


class RestaurantRegistrationReviewResponse(BaseModel):
    message: str
    registration: RestaurantRegistrationSummaryResponse
