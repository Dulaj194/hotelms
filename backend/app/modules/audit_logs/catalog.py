from __future__ import annotations

from typing import Any


_EVENT_DEFINITIONS: dict[str, dict[str, str]] = {
    "restaurant_registration_success": {
        "category": "onboarding",
        "severity": "warning",
        "title": "New registration submitted",
    },
    "restaurant_registration_approved": {
        "category": "onboarding",
        "severity": "success",
        "title": "Registration approved",
    },
    "restaurant_registration_rejected": {
        "category": "onboarding",
        "severity": "danger",
        "title": "Registration rejected",
    },
    "settings_request_submitted": {
        "category": "governance",
        "severity": "warning",
        "title": "Settings request submitted",
    },
    "settings_request_approved": {
        "category": "governance",
        "severity": "success",
        "title": "Settings request approved",
    },
    "settings_request_rejected": {
        "category": "governance",
        "severity": "danger",
        "title": "Settings request rejected",
    },
    "subscription_trial_assigned": {
        "category": "subscriptions",
        "severity": "success",
        "title": "Trial assigned",
    },
    "subscription_activated": {
        "category": "subscriptions",
        "severity": "success",
        "title": "Subscription activated",
    },
    "subscription_updated": {
        "category": "subscriptions",
        "severity": "info",
        "title": "Subscription updated",
    },
    "subscription_cancelled": {
        "category": "subscriptions",
        "severity": "warning",
        "title": "Subscription cancelled",
    },
    "subscription_expired": {
        "category": "subscriptions",
        "severity": "warning",
        "title": "Subscription expired",
    },
    "platform_user_created": {
        "category": "users",
        "severity": "info",
        "title": "Platform user created",
    },
    "platform_user_updated": {
        "category": "users",
        "severity": "info",
        "title": "Platform user updated",
    },
    "platform_user_disabled": {
        "category": "users",
        "severity": "warning",
        "title": "Platform user disabled",
    },
    "platform_user_deleted": {
        "category": "users",
        "severity": "danger",
        "title": "Platform user deleted",
    },
    "staff_created": {
        "category": "users",
        "severity": "info",
        "title": "Hotel staff created",
    },
    "staff_updated": {
        "category": "users",
        "severity": "info",
        "title": "Hotel staff updated",
    },
    "staff_disabled": {
        "category": "users",
        "severity": "warning",
        "title": "Hotel staff disabled",
    },
    "staff_deleted": {
        "category": "users",
        "severity": "danger",
        "title": "Hotel staff deleted",
    },
    "restaurant_api_key_generated": {
        "category": "integrations",
        "severity": "warning",
        "title": "API key generated",
    },
    "restaurant_api_key_rotated": {
        "category": "integrations",
        "severity": "warning",
        "title": "API key rotated",
    },
    "restaurant_api_key_revoked": {
        "category": "integrations",
        "severity": "danger",
        "title": "API key revoked",
    },
    "restaurant_integration_updated": {
        "category": "integrations",
        "severity": "info",
        "title": "Integration settings updated",
    },
    "restaurant_webhook_health_checked": {
        "category": "integrations",
        "severity": "info",
        "title": "Webhook health checked",
    },
    "login_failed": {
        "category": "security",
        "severity": "danger",
        "title": "Failed login attempt",
    },
}

HIGH_SIGNAL_EVENT_TYPES = frozenset(_EVENT_DEFINITIONS.keys())


def get_event_category(event_type: str) -> str:
    return _EVENT_DEFINITIONS.get(event_type, {}).get("category", "operations")


def get_event_severity(event_type: str, metadata: dict[str, Any] | None = None) -> str:
    metadata = metadata or {}
    if event_type == "restaurant_webhook_health_checked":
        status_value = str(metadata.get("webhook_status") or "").lower()
        if status_value == "healthy":
            return "success"
        if status_value in {"disabled", "not_configured"}:
            return "warning"
        return "danger"
    return _EVENT_DEFINITIONS.get(event_type, {}).get("severity", "info")


def get_event_title(event_type: str) -> str:
    return _EVENT_DEFINITIONS.get(event_type, {}).get(
        "title",
        event_type.replace("_", " ").title(),
    )


def _entity_label(
    *,
    restaurant_name: str | None,
    restaurant_id: int | None,
) -> str:
    if restaurant_name:
        return restaurant_name
    if restaurant_id is not None:
        return f"Hotel #{restaurant_id}"
    return "Platform"


def build_event_message(
    *,
    event_type: str,
    metadata: dict[str, Any] | None,
    restaurant_name: str | None,
    restaurant_id: int | None,
) -> str:
    metadata = metadata or {}
    hotel_label = _entity_label(
        restaurant_name=restaurant_name,
        restaurant_id=restaurant_id,
    )

    if event_type == "restaurant_registration_success":
        return f"{hotel_label} submitted a new onboarding request."
    if event_type == "restaurant_registration_approved":
        return f"{hotel_label} was approved and trial access was activated."
    if event_type == "restaurant_registration_rejected":
        return f"{hotel_label} registration was rejected."
    if event_type == "settings_request_submitted":
        count = int(metadata.get("requested_change_count") or 0)
        return f"{hotel_label} submitted {count or 'new'} setting change(s) for review."
    if event_type == "settings_request_approved":
        return f"{hotel_label} settings request was approved."
    if event_type == "settings_request_rejected":
        return f"{hotel_label} settings request was rejected."
    if event_type == "subscription_trial_assigned":
        package_name = metadata.get("package_name") or metadata.get("next_package_name") or "trial package"
        return f"{hotel_label} received {package_name} access."
    if event_type == "subscription_activated":
        package_name = metadata.get("package_name") or metadata.get("next_package_name") or "a package"
        return f"{hotel_label} subscription was activated on {package_name}."
    if event_type == "subscription_updated":
        previous_package = metadata.get("previous_package_name") or metadata.get("previous_package_code")
        next_package = metadata.get("next_package_name") or metadata.get("next_package_code")
        if previous_package and next_package and previous_package != next_package:
            return f"{hotel_label} package changed from {previous_package} to {next_package}."
        next_status = metadata.get("next_status")
        if next_status:
            return f"{hotel_label} subscription status changed to {next_status}."
        return f"{hotel_label} subscription details were updated."
    if event_type == "subscription_cancelled":
        return f"{hotel_label} subscription was cancelled."
    if event_type == "subscription_expired":
        return f"{hotel_label} subscription expired and access was reduced."
    if event_type == "platform_user_disabled":
        return "A platform super admin account was disabled."
    if event_type == "platform_user_deleted":
        return "A platform super admin account was deleted."
    if event_type == "staff_disabled":
        return f"{hotel_label} staff access was disabled."
    if event_type == "staff_deleted":
        return f"{hotel_label} staff account was removed."
    if event_type == "restaurant_api_key_generated":
        return f"{hotel_label} integration API key was generated."
    if event_type == "restaurant_api_key_rotated":
        return f"{hotel_label} integration API key was rotated."
    if event_type == "restaurant_api_key_revoked":
        return f"{hotel_label} integration API key was revoked."
    if event_type == "restaurant_integration_updated":
        return f"{hotel_label} integration settings were updated."
    if event_type == "restaurant_webhook_health_checked":
        webhook_status = metadata.get("webhook_status") or "unknown"
        return f"{hotel_label} webhook health check finished with status: {webhook_status}."
    if event_type == "login_failed":
        reason = metadata.get("reason")
        if reason:
            return f"Failed login attempt detected ({reason})."
        return "Failed login attempt detected."

    return f"{hotel_label}: {get_event_title(event_type)}."
