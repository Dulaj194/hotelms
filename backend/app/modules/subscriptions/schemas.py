from datetime import datetime
from typing import Literal

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
