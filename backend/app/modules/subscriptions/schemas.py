from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class SubscriptionResponse(BaseModel):
    id: int | None
    restaurant_id: int
    package_id: int | None
    package_name: str | None
    package_code: str | None
    status: str
    is_trial: bool
    started_at: datetime | None
    expires_at: datetime | None
    trial_started_at: datetime | None
    trial_expires_at: datetime | None


class SubscriptionChangeActorResponse(BaseModel):
    user_id: int | None = None
    full_name: str | None = None
    email: str | None = None


class SubscriptionChangeHistoryItemResponse(BaseModel):
    id: int
    restaurant_id: int
    subscription_id: int | None
    action: str
    source: str
    change_reason: str | None
    previous_package_id: int | None
    previous_package_name: str | None
    previous_package_code: str | None
    next_package_id: int | None
    next_package_name: str | None
    next_package_code: str | None
    previous_status: str | None
    next_status: str | None
    previous_expires_at: datetime | None
    next_expires_at: datetime | None
    actor: SubscriptionChangeActorResponse
    metadata: dict[str, Any]
    created_at: datetime


class SubscriptionChangeHistoryResponse(BaseModel):
    items: list[SubscriptionChangeHistoryItemResponse]
    total: int


class SubscriptionStatusResponse(BaseModel):
    status: str
    is_active: bool
    is_trial: bool
    is_expired: bool
    started_at: datetime | None
    expires_at: datetime | None


class SubscriptionPrivilegeResponse(BaseModel):
    restaurant_id: int
    status: str
    privileges: list[str]


class SubscriptionAccessModuleResponse(BaseModel):
    key: str
    label: str
    description: str
    package_privileges: list[str] = Field(default_factory=list)
    feature_flags: list[str] = Field(default_factory=list)
    enabled_by_package: bool = False
    enabled_by_feature_flags: bool = True
    is_enabled: bool = False


class SubscriptionAccessPrivilegeResponse(BaseModel):
    code: str
    label: str
    description: str
    modules: list[SubscriptionAccessModuleResponse]


class SubscriptionAccessFeatureFlagResponse(BaseModel):
    code: str
    key: str
    label: str
    description: str
    enabled: bool
    modules: list[SubscriptionAccessModuleResponse]


class SubscriptionAccessSummaryResponse(BaseModel):
    restaurant_id: int
    status: str
    is_active: bool
    package_id: int | None
    package_name: str | None
    package_code: str | None
    privileges: list[SubscriptionAccessPrivilegeResponse]
    feature_flags: list[SubscriptionAccessFeatureFlagResponse]
    module_access: list[SubscriptionAccessModuleResponse]
    enabled_modules: list[SubscriptionAccessModuleResponse]


class ActivateSubscriptionRequest(BaseModel):
    package_id: int | None = Field(default=None)
    package_code: str | None = Field(default=None, min_length=1, max_length=50)

    @model_validator(mode="after")
    def validate_package_selector(self):
        if self.package_id is None and not self.package_code:
            raise ValueError("Either package_id or package_code is required.")
        return self


class ActivateSubscriptionResponse(BaseModel):
    message: str
    subscription: SubscriptionResponse


class StartTrialResponse(BaseModel):
    message: str
    subscription: SubscriptionResponse


class CancelSubscriptionResponse(BaseModel):
    message: str
    status: Literal["cancelled"]


class GenericMessageResponse(BaseModel):
    message: str


# ─── Super-admin schemas ──────────────────────────────────────────────────────


class SuperAdminSubscriptionUpdateRequest(BaseModel):
    """Payload for super_admin to update any restaurant's subscription.

    At least one field must be supplied.  Omitted fields are left unchanged.
    """

    status: str | None = Field(
        None, description="One of: trial, active, expired, cancelled"
    )
    expires_at: datetime | None = None
    package_id: int | None = None
    change_reason: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def at_least_one_field(
        self,
    ) -> "SuperAdminSubscriptionUpdateRequest":
        if (
            self.status is None
            and self.expires_at is None
            and self.package_id is None
        ):
            raise ValueError(
                "At least one field (status, expires_at, package_id) must be provided."
            )
        return self


class ExpireOverdueResponse(BaseModel):
    message: str
    expired_count: int
