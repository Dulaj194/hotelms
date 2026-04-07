from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

RegistrationStatusValue = Literal["PENDING", "APPROVED", "REJECTED"]
WebhookHealthStatusValue = Literal["not_configured", "healthy", "degraded", "disabled"]
WebhookDeliveryStatusValue = Literal["success", "failed"]


class RestaurantFeatureFlagsResponse(BaseModel):
    steward: bool
    housekeeping: bool
    kds: bool
    reports: bool
    accountant: bool
    cashier: bool


class RestaurantFeatureFlagsUpdateRequest(BaseModel):
    steward: bool | None = None
    housekeeping: bool | None = None
    kds: bool | None = None
    reports: bool | None = None
    accountant: bool | None = None
    cashier: bool | None = None


class RestaurantApiKeySummaryResponse(BaseModel):
    has_key: bool = False
    is_active: bool = False
    masked_key: str | None = None
    rotated_at: datetime | None = None


class RestaurantWebhookSecretSummaryResponse(BaseModel):
    has_secret: bool = False
    header_name: str | None = None
    masked_value: str | None = None
    rotated_at: datetime | None = None


class RestaurantIntegrationSettingsResponse(BaseModel):
    public_ordering_enabled: bool = False
    webhook_url: str | None = None
    webhook_secret_header_name: str | None = None
    webhook_status: WebhookHealthStatusValue = "not_configured"
    webhook_last_checked_at: datetime | None = None
    webhook_last_error: str | None = None


class RestaurantIntegrationResponse(BaseModel):
    api_key: RestaurantApiKeySummaryResponse = Field(
        default_factory=RestaurantApiKeySummaryResponse
    )
    settings: RestaurantIntegrationSettingsResponse = Field(
        default_factory=RestaurantIntegrationSettingsResponse
    )
    webhook_secret: RestaurantWebhookSecretSummaryResponse = Field(
        default_factory=RestaurantWebhookSecretSummaryResponse
    )


class RestaurantWebhookDeliveryActorResponse(BaseModel):
    user_id: int | None = None
    full_name: str | None = None
    email: str | None = None


class RestaurantWebhookDeliveryResponse(BaseModel):
    id: int
    event_type: str
    request_url: str
    delivery_status: WebhookDeliveryStatusValue
    attempt_number: int
    is_retry: bool
    retried_from_delivery_id: int | None = None
    http_status_code: int | None = None
    error_message: str | None = None
    response_excerpt: str | None = None
    response_time_ms: int | None = None
    triggered_by: RestaurantWebhookDeliveryActorResponse = Field(
        default_factory=RestaurantWebhookDeliveryActorResponse
    )
    created_at: datetime


class RestaurantWebhookFailureTrendPointResponse(BaseModel):
    date: str
    failed_count: int


class RestaurantIntegrationOpsResponse(BaseModel):
    secret: RestaurantWebhookSecretSummaryResponse = Field(
        default_factory=RestaurantWebhookSecretSummaryResponse
    )
    last_delivery: RestaurantWebhookDeliveryResponse | None = None
    recent_deliveries: list[RestaurantWebhookDeliveryResponse] = Field(default_factory=list)
    failure_trend: list[RestaurantWebhookFailureTrendPointResponse] = Field(default_factory=list)


class RestaurantWebhookSecretProvisionResponse(BaseModel):
    message: str
    secret_value: str
    summary: RestaurantWebhookSecretSummaryResponse


class RestaurantWebhookDeliveryActionResponse(BaseModel):
    message: str
    delivery: RestaurantWebhookDeliveryResponse


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
    feature_flags: RestaurantFeatureFlagsResponse
    integration: RestaurantIntegrationResponse = Field(
        default_factory=RestaurantIntegrationResponse
    )
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
    feature_flags: RestaurantFeatureFlagsUpdateRequest | None = None
    is_active: bool | None = None


class RestaurantIntegrationUpdateRequest(BaseModel):
    public_ordering_enabled: bool | None = None
    webhook_url: str | None = Field(default=None, max_length=500)
    webhook_secret_header_name: str | None = Field(default=None, max_length=100)


class RestaurantApiKeyProvisionResponse(BaseModel):
    message: str
    api_key: str
    summary: RestaurantApiKeySummaryResponse


class RestaurantWebhookHealthRefreshResponse(BaseModel):
    message: str
    settings: RestaurantIntegrationSettingsResponse


class RestaurantDeleteResponse(BaseModel):
    message: str
    restaurant_id: int


class RestaurantLogoUploadResponse(BaseModel):
    logo_url: str
    message: str = "Logo uploaded successfully."


class RestaurantStaffPasswordResetRequest(BaseModel):
    temporary_password: str | None = Field(
        default=None,
        min_length=8,
        max_length=128,
        description=(
            "Optional temporary password for the target account. "
            "If omitted, a secure temporary password is generated."
        ),
    )


class RestaurantStaffPasswordResetResponse(BaseModel):
    message: str
    user_id: int
    role: str
    must_change_password: bool
    email_sent: bool
    temporary_password: str


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
