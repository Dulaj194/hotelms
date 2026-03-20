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
    billing_email: str | None
    tax_id: str | None
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
    overdue_orders: int
    today_orders: int
    exception_count: int
    pending_housekeeping_tasks: int


class DashboardWarningSummary(BaseModel):
    trial_expiry_warning: bool
    trial_expiry_message: str | None


class DashboardAlertAction(BaseModel):
    label: str
    path: str


class DashboardAlertItem(BaseModel):
    key: str
    level: str
    title: str
    message: str
    blocking: bool
    should_show: bool
    dismissible: bool
    visibility_policy: str
    action: DashboardAlertAction


class DashboardSetupWizardSummary(BaseModel):
    should_show: bool
    has_blocking_missing: bool
    progress_percent: int
    current_step: int
    total_steps: int
    completed_keys: list[str]
    missing_fields: list[str]


class DashboardSetupRequirement(BaseModel):
    key: str
    label: str
    severity: str
    description: str
    completed: bool


class DashboardModuleLane(BaseModel):
    key: str
    label: str
    path: str
    visible: bool


class DashboardPrivilegeMap(BaseModel):
    role: str
    privileges: list[str]


class SetupProgressUpdateRequest(BaseModel):
    current_step: int
    completed_keys: list[str]


class AlertDismissRequest(BaseModel):
    hours: int = 8


class GenericDashboardMessage(BaseModel):
    message: str


class AdminDashboardOverviewResponse(BaseModel):
    restaurant: DashboardRestaurantSummary
    subscription: DashboardSubscriptionSummary
    admins: list[DashboardAdminUser]
    metrics: DashboardOverviewMetrics
    warnings: DashboardWarningSummary
    alerts: list[DashboardAlertItem]
    setup_wizard: DashboardSetupWizardSummary
    setup_requirements: list[DashboardSetupRequirement]
    module_lanes: list[DashboardModuleLane]
    privilege_map: DashboardPrivilegeMap
    sla_priority_model: list[str]
    default_module: str  # Lane key to auto-navigate to (orders, housekeeping, dashboard, etc.)
