from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ExpiryThresholdRule:
    key: str
    max_days: int
    level: str
    blocking: bool
    cta_label: str
    cta_path: str
    dismiss_hours: int


EXPIRY_THRESHOLD_RULES: tuple[ExpiryThresholdRule, ...] = (
    ExpiryThresholdRule(
        key="trial-expired",
        max_days=0,
        level="critical",
        blocking=True,
        cta_label="Renew Plan",
        cta_path="/admin/subscription",
        dismiss_hours=0,
    ),
    ExpiryThresholdRule(
        key="trial-critical-1",
        max_days=1,
        level="critical",
        blocking=False,
        cta_label="Renew Plan",
        cta_path="/admin/subscription",
        dismiss_hours=0,
    ),
    ExpiryThresholdRule(
        key="trial-warning-3",
        max_days=3,
        level="warning",
        blocking=False,
        cta_label="Contact Billing",
        cta_path="/admin/subscription",
        dismiss_hours=8,
    ),
    ExpiryThresholdRule(
        key="trial-info-7",
        max_days=7,
        level="info",
        blocking=False,
        cta_label="View Plan",
        cta_path="/admin/subscription",
        dismiss_hours=24,
    ),
)


SETUP_REQUIREMENT_MATRIX = [
    {
        "key": "country",
        "label": "Country",
        "severity": "blocking",
        "description": "Required before enabling order workflows.",
    },
    {
        "key": "currency",
        "label": "Currency",
        "severity": "blocking",
        "description": "Required before enabling order workflows.",
    },
    {
        "key": "opening_time",
        "label": "Opening time",
        "severity": "blocking",
        "description": "Required for operational timing policy.",
    },
    {
        "key": "closing_time",
        "label": "Closing time",
        "severity": "blocking",
        "description": "Required for operational timing policy.",
    },
    {
        "key": "billing_email",
        "label": "Billing email",
        "severity": "later",
        "description": "Recommended for invoices and subscription notices.",
    },
    {
        "key": "logo_url",
        "label": "Brand logo",
        "severity": "later",
        "description": "Recommended for branded guest interfaces.",
    },
]


MODULE_LANES = [
    {
        "key": "menu",
        "label": "Menu / Items",
        "path": "/admin/menu/menus",
        "required_roles": ["owner", "admin"],
        "required_privileges": [],
    },
    {
        "key": "orders",
        "label": "Orders / Room Orders",
        "path": "/admin/kitchen",
        "required_roles": ["owner", "admin", "steward"],
        "required_privileges": ["QR_MENU"],
    },
    {
        "key": "housekeeping",
        "label": "Housekeeping",
        "path": "/admin/housekeeping",
        "required_roles": ["owner", "admin", "housekeeper"],
        "required_privileges": ["HOUSEKEEPING"],
    },
    {
        "key": "reports",
        "label": "Reports",
        "path": "/admin/reports",
        "required_roles": ["owner", "admin", "steward"],
        "required_privileges": ["QR_MENU"],
    },
    {
        "key": "billing",
        "label": "Billing",
        "path": "/admin/billing",
        "required_roles": ["owner", "admin", "steward", "cashier", "accountant"],
        "required_privileges": ["QR_MENU"],
    },
    {
        "key": "settings",
        "label": "Settings",
        "path": "/admin/restaurant-profile",
        "required_roles": ["owner", "admin"],
        "required_privileges": [],
    },
]


SLA_PRIORITY_MODEL = [
    "urgent_orders",
    "pending_housekeeping",
    "reporting_tasks",
]


def get_default_module(privileges: list[str], role: str | None = None) -> str:
    """Return the recommended landing lane key for the current privilege set."""
    priv_upper = {p.upper() for p in privileges}

    if role in {"cashier", "accountant"} and "QR_MENU" in priv_upper:
        return "billing"

    # QR-menu work gets first priority when it is available.
    if "QR_MENU" in priv_upper:
        return "orders"

    if "HOUSEKEEPING" in priv_upper:
        return "housekeeping"

    return "dashboard"
