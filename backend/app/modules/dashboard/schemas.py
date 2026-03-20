from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class DashboardRestaurantSummary(BaseModel):
    id: int
    name: str
    email: str | None
    contact_number: str | None
    address: str | None
    logo_url: str | None
    country: str | None
    currency: str | None
    opening_time: str | None
    closing_time: str | None


class DashboardSubscriptionSummary(BaseModel):
    status: str
    is_trial: bool
    package_name: str | None
    package_code: str | None
    trial_expires_at: datetime | None
    days_remaining: int | None
    privileges: list[str]


class DashboardAdminUser(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    is_active: bool


class DashboardOverviewMetrics(BaseModel):
    pending_orders: int
    pending_housekeeping_tasks: int


class DashboardWarningSummary(BaseModel):
    trial_expiry_warning: bool
    trial_expiry_message: str | None


class DashboardSetupWizardSummary(BaseModel):
    should_show: bool
    missing_fields: list[str]


class AdminDashboardOverviewResponse(BaseModel):
    restaurant: DashboardRestaurantSummary
    subscription: DashboardSubscriptionSummary
    admins: list[DashboardAdminUser]
    metrics: DashboardOverviewMetrics
    warnings: DashboardWarningSummary
    setup_wizard: DashboardSetupWizardSummary
