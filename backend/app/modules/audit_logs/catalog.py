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
    "restaurant_created_by_super_admin": {
        "category": "onboarding",
        "severity": "success",
        "title": "Restaurant created",
    },
    "restaurant_profile_updated_by_super_admin": {
        "category": "onboarding",
        "severity": "info",
        "title": "Restaurant profile updated",
    },
    "restaurant_deleted_by_super_admin": {
        "category": "onboarding",
        "severity": "danger",
        "title": "Restaurant deleted",
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
    "restaurant_webhook_secret_generated": {
        "category": "integrations",
        "severity": "warning",
        "title": "Webhook secret generated",
    },
    "restaurant_webhook_secret_rotated": {
        "category": "integrations",
        "severity": "warning",
        "title": "Webhook secret rotated",
    },
    "restaurant_webhook_secret_revoked": {
        "category": "integrations",
        "severity": "danger",
        "title": "Webhook secret revoked",
    },
    "restaurant_webhook_delivery_failed": {
        "category": "integrations",
        "severity": "danger",
        "title": "Webhook delivery failed",
    },
    "stripe_webhook_failed": {
        "category": "billing",
        "severity": "danger",
        "title": "Stripe webhook failed",
    },
    "login_failed": {
        "category": "security",
        "severity": "danger",
        "title": "Failed login attempt",
    },
    "site_page_updated": {
        "category": "site_content",
        "severity": "info",
        "title": "Site page draft updated",
    },
    "site_page_published": {
        "category": "site_content",
        "severity": "success",
        "title": "Site page published",
    },
    "site_page_unpublished": {
        "category": "site_content",
        "severity": "warning",
        "title": "Site page unpublished",
    },
    "site_blog_created": {
        "category": "site_content",
        "severity": "info",
        "title": "Blog draft created",
    },
    "site_blog_updated": {
        "category": "site_content",
        "severity": "info",
        "title": "Blog draft updated",
    },
    "site_blog_published": {
        "category": "site_content",
        "severity": "success",
        "title": "Blog post published",
    },
    "site_blog_unpublished": {
        "category": "site_content",
        "severity": "warning",
        "title": "Blog post unpublished",
    },
    "site_blog_deleted": {
        "category": "site_content",
        "severity": "danger",
        "title": "Blog draft deleted",
    },
    "site_contact_lead_updated": {
        "category": "site_content",
        "severity": "info",
        "title": "Lead inbox item updated",
    },
}

HIGH_SIGNAL_EVENT_TYPES = frozenset(_EVENT_DEFINITIONS.keys())


def get_event_types_by_category(category: str) -> set[str]:
    normalized = category.strip().lower()
    return {
        event_type
        for event_type, definition in _EVENT_DEFINITIONS.items()
        if str(definition.get("category") or "").lower() == normalized
    }


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
    if event_type == "restaurant_created_by_super_admin":
        return f"{hotel_label} tenant was provisioned by super admin."
    if event_type == "restaurant_profile_updated_by_super_admin":
        return f"{hotel_label} profile was updated by super admin."
    if event_type == "restaurant_deleted_by_super_admin":
        return f"{hotel_label} tenant was deleted by super admin."
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
    if event_type == "restaurant_webhook_secret_generated":
        header_name = metadata.get("header_name") or "default header"
        return f"{hotel_label} webhook secret was generated for {header_name}."
    if event_type == "restaurant_webhook_secret_rotated":
        header_name = metadata.get("header_name") or "default header"
        return f"{hotel_label} webhook secret was rotated for {header_name}."
    if event_type == "restaurant_webhook_secret_revoked":
        header_name = metadata.get("header_name") or "default header"
        return f"{hotel_label} webhook secret was revoked for {header_name}."
    if event_type == "restaurant_webhook_delivery_failed":
        webhook_event_type = metadata.get("webhook_event_type") or "unknown_event"
        error_message = metadata.get("error_message") or "unknown_error"
        return f"{hotel_label} webhook delivery failed for {webhook_event_type} ({error_message})."
    if event_type == "stripe_webhook_failed":
        reason = metadata.get("reason") or "unknown_error"
        event_name = metadata.get("stripe_event_type") or "unknown_event"
        return f"Stripe webhook processing failed for {event_name} ({reason})."
    if event_type == "login_failed":
        reason = metadata.get("reason")
        if reason:
            return f"Failed login attempt detected ({reason})."
        return "Failed login attempt detected."
    if event_type == "site_page_updated":
        page_slug = metadata.get("page_slug") or "unknown"
        return f"Site page '{page_slug}' draft was updated."
    if event_type == "site_page_published":
        page_slug = metadata.get("page_slug") or "unknown"
        return f"Site page '{page_slug}' was published."
    if event_type == "site_page_unpublished":
        page_slug = metadata.get("page_slug") or "unknown"
        return f"Site page '{page_slug}' was unpublished."
    if event_type == "site_blog_created":
        blog_slug = metadata.get("blog_slug") or "unknown"
        return f"Blog draft '{blog_slug}' was created."
    if event_type == "site_blog_updated":
        blog_slug = metadata.get("blog_slug") or "unknown"
        return f"Blog draft '{blog_slug}' was updated."
    if event_type == "site_blog_published":
        blog_slug = metadata.get("blog_slug") or "unknown"
        return f"Blog post '{blog_slug}' was published."
    if event_type == "site_blog_unpublished":
        blog_slug = metadata.get("blog_slug") or "unknown"
        return f"Blog post '{blog_slug}' was unpublished."
    if event_type == "site_blog_deleted":
        blog_slug = metadata.get("blog_slug") or "unknown"
        return f"Blog draft '{blog_slug}' was deleted."
    if event_type == "site_contact_lead_updated":
        lead_id = metadata.get("lead_id") or "unknown"
        return f"Contact lead #{lead_id} was updated in the lead inbox."

    return f"{hotel_label}: {get_event_title(event_type)}."
