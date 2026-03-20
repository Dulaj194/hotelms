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
        "description": "Recommended for billing notifications.",
    },
    {
        "key": "tax_id",
        "label": "Tax ID",
        "severity": "later",
        "description": "Recommended for invoicing and tax reports.",
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


def get_default_module(privileges: list[str], role: str) -> str:
    """
    Determine which module should load by default based on privilege priority.
    
    Decision Tree (first match wins):
    1. If has both QR_MENU and HOUSEKEEPING → Menu (menu has priority)
    2. If has only QR_MENU → Menu
    3. If has only HOUSEKEEPING → Housekeeping
    4. Fallback → Dashboard (no module privileges)
    
    Args:
        privileges: List of privilege codes (e.g., ["QR_MENU", "HOUSEKEEPING"])
        role: User role (owner, admin, steward, etc.)
    
    Returns:
        Lane key to auto-navigate to (e.g., "orders", "housekeeping", "dashboard")
    """
    priv_upper = {p.upper() for p in privileges}
    
    # Priority 1: Both menu and housekeeping → show menu first
    if "QR_MENU" in priv_upper and "HOUSEKEEPING" in priv_upper:
        return "orders"  # Menu has priority
    
    # Priority 2: Only menu
    if "QR_MENU" in priv_upper:
        return "orders"
    
    # Priority 3: Only housekeeping
    if "HOUSEKEEPING" in priv_upper:
        return "housekeeping"
    
    # Fallback: No module privileges (stay on dashboard)
    return "dashboard"
