"""Centralized access control matrix for super admin endpoints."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class HTTPMethod(str, Enum):
    """HTTP Methods."""

    GET = "GET"
    POST = "POST"
    PATCH = "PATCH"
    DELETE = "DELETE"


class PlatformPermissionAction(str, Enum):
    """Permission actions used for policy-level access checks."""

    VIEW = "view"
    REVIEW = "review"
    APPROVE = "approve"
    MUTATE = "mutate"


class PlatformPermissionResource(str, Enum):
    """Resources that can be protected by platform permission actions."""

    NOTIFICATIONS_QUEUE = "notifications_queue"
    REGISTRATIONS = "registrations"
    SETTINGS_REQUESTS = "settings_requests"
    AUDIT_LOGS = "audit_logs"


@dataclass(frozen=True)
class AccessRule:
    """Single access control rule."""

    module: str
    endpoint: str
    method: HTTPMethod
    required_scopes: tuple[str, ...]
    description: str
    sensitive: bool = False


@dataclass(frozen=True)
class PlatformPermissionRule:
    """Action-level permission mapping for frontend/backend policy alignment."""

    resource: PlatformPermissionResource
    action: PlatformPermissionAction
    required_scopes: tuple[str, ...]
    description: str


# ============================================================================
# ACCESS CONTROL MATRIX - Single Source of Truth
# ============================================================================
# Format: module -> endpoint -> method -> required_scopes
# Scopes: ops_viewer, tenant_admin, billing_admin, security_admin

ACCESS_CONTROL_RULES: tuple[AccessRule, ...] = (
    # ========================================================================
    # AUTH MODULE
    # ========================================================================
    AccessRule(
        module="auth",
        endpoint="POST /api/v1/auth/login/super-admin",
        method=HTTPMethod.POST,
        required_scopes=(),  # No scopes required - basic login
        description="Super admin login with email/password",
        sensitive=True,
    ),
    # ========================================================================
    # AUDIT LOGS MODULE
    # ========================================================================
    AccessRule(
        module="audit_logs",
        endpoint="GET /api/v1/audit-logs/notifications",
        method=HTTPMethod.GET,
        required_scopes=("ops_viewer", "security_admin"),
        description="List super admin notifications with limit",
    ),
    AccessRule(
        module="audit_logs",
        endpoint="GET /api/v1/audit-logs/notifications/assignees",
        method=HTTPMethod.GET,
        required_scopes=("ops_viewer", "security_admin"),
        description="List platform users eligible for notification assignment",
    ),
    AccessRule(
        module="audit_logs",
        endpoint="PATCH /api/v1/audit-logs/notifications/{notification_id}",
        method=HTTPMethod.PATCH,
        required_scopes=("security_admin",),
        description="Update notification state (read, assigned, acknowledged, snoozed)",
        sensitive=True,
    ),
    # ========================================================================
    # PACKAGES MODULE
    # ========================================================================
    AccessRule(
        module="packages",
        endpoint="GET /api/v1/packages/admin",
        method=HTTPMethod.GET,
        required_scopes=("billing_admin",),
        description="List all packages (admin view)",
    ),
    AccessRule(
        module="packages",
        endpoint="GET /api/v1/packages/admin/privileges",
        method=HTTPMethod.GET,
        required_scopes=("billing_admin",),
        description="List package privilege catalog",
    ),
    AccessRule(
        module="packages",
        endpoint="POST /api/v1/packages/admin",
        method=HTTPMethod.POST,
        required_scopes=("billing_admin",),
        description="Create new package",
        sensitive=True,
    ),
    AccessRule(
        module="packages",
        endpoint="GET /api/v1/packages/admin/{package_id}",
        method=HTTPMethod.GET,
        required_scopes=("billing_admin",),
        description="Get package details",
    ),
    AccessRule(
        module="packages",
        endpoint="PATCH /api/v1/packages/admin/{package_id}",
        method=HTTPMethod.PATCH,
        required_scopes=("billing_admin",),
        description="Update package pricing and privileges",
        sensitive=True,
    ),
    AccessRule(
        module="packages",
        endpoint="DELETE /api/v1/packages/admin/{package_id}",
        method=HTTPMethod.DELETE,
        required_scopes=("billing_admin",),
        description="Mark package as inactive",
        sensitive=True,
    ),
    # ========================================================================
    # SUBSCRIPTIONS MODULE
    # ========================================================================
    AccessRule(
        module="subscriptions",
        endpoint="POST /api/v1/subscriptions/admin/expire-overdue",
        method=HTTPMethod.POST,
        required_scopes=("billing_admin",),
        description="Manually trigger subscription expiry check",
        sensitive=True,
    ),
    AccessRule(
        module="subscriptions",
        endpoint="GET /api/v1/subscriptions/admin/{restaurant_id}",
        method=HTTPMethod.GET,
        required_scopes=("ops_viewer", "tenant_admin", "billing_admin"),
        description="Get current subscription for restaurant",
    ),
    AccessRule(
        module="subscriptions",
        endpoint="GET /api/v1/subscriptions/admin/{restaurant_id}/history",
        method=HTTPMethod.GET,
        required_scopes=("ops_viewer", "tenant_admin", "billing_admin"),
        description="Get subscription change history",
    ),
    AccessRule(
        module="subscriptions",
        endpoint="GET /api/v1/subscriptions/admin/{restaurant_id}/summary",
        method=HTTPMethod.GET,
        required_scopes=("ops_viewer", "tenant_admin", "billing_admin"),
        description="Get package access summary",
    ),
    AccessRule(
        module="subscriptions",
        endpoint="PATCH /api/v1/subscriptions/admin/{restaurant_id}",
        method=HTTPMethod.PATCH,
        required_scopes=("billing_admin",),
        description="Update subscription status, expiry, or package",
        sensitive=True,
    ),
    # ========================================================================
    # USERS (PLATFORM) MODULE
    # ========================================================================
    AccessRule(
        module="users",
        endpoint="GET /api/v1/users/platform",
        method=HTTPMethod.GET,
        required_scopes=("security_admin",),
        description="List all platform users with optional active filter",
    ),
    AccessRule(
        module="users",
        endpoint="POST /api/v1/users/platform",
        method=HTTPMethod.POST,
        required_scopes=("security_admin",),
        description="Create new platform user with email/username/phone",
        sensitive=True,
    ),
    AccessRule(
        module="users",
        endpoint="GET /api/v1/users/platform/{user_id}",
        method=HTTPMethod.GET,
        required_scopes=("security_admin",),
        description="Get platform user details",
    ),
    AccessRule(
        module="users",
        endpoint="PATCH /api/v1/users/platform/{user_id}",
        method=HTTPMethod.PATCH,
        required_scopes=("security_admin",),
        description="Update platform user scopes, status, or password",
        sensitive=True,
    ),
    AccessRule(
        module="users",
        endpoint="PATCH /api/v1/users/platform/{user_id}/disable",
        method=HTTPMethod.PATCH,
        required_scopes=("security_admin",),
        description="Disable platform user account",
        sensitive=True,
    ),
    AccessRule(
        module="users",
        endpoint="PATCH /api/v1/users/platform/{user_id}/enable",
        method=HTTPMethod.PATCH,
        required_scopes=("security_admin",),
        description="Enable platform user account",
        sensitive=True,
    ),
    AccessRule(
        module="users",
        endpoint="DELETE /api/v1/users/platform/{user_id}",
        method=HTTPMethod.DELETE,
        required_scopes=("security_admin",),
        description="Delete platform user permanently",
        sensitive=True,
    ),
    # ========================================================================
    # RESTAURANTS MODULE
    # ========================================================================
    AccessRule(
        module="restaurants",
        endpoint="GET /api/v1/restaurants",
        method=HTTPMethod.GET,
        required_scopes=("ops_viewer", "tenant_admin", "billing_admin", "security_admin"),
        description="List all restaurants",
    ),
    AccessRule(
        module="restaurants",
        endpoint="GET /api/v1/restaurants/registrations/pending",
        method=HTTPMethod.GET,
        required_scopes=("ops_viewer", "tenant_admin"),
        description="List pending restaurant registrations",
    ),
    AccessRule(
        module="restaurants",
        endpoint="GET /api/v1/restaurants/registrations/history",
        method=HTTPMethod.GET,
        required_scopes=("ops_viewer", "tenant_admin"),
        description="Get restaurant registration history",
    ),
    AccessRule(
        module="restaurants",
        endpoint="PATCH /api/v1/restaurants/registrations/{registration_id}/review",
        method=HTTPMethod.PATCH,
        required_scopes=("tenant_admin",),
        description="Approve or reject registration",
        sensitive=True,
    ),
    AccessRule(
        module="restaurants",
        endpoint="GET /api/v1/restaurants/{restaurant_id}",
        method=HTTPMethod.GET,
        required_scopes=("ops_viewer", "tenant_admin", "billing_admin", "security_admin"),
        description="Get restaurant details",
    ),
    AccessRule(
        module="restaurants",
        endpoint="PATCH /api/v1/restaurants/{restaurant_id}",
        method=HTTPMethod.PATCH,
        required_scopes=("tenant_admin",),
        description="Update restaurant settings and profile",
        sensitive=True,
    ),
    AccessRule(
        module="restaurants",
        endpoint="DELETE /api/v1/restaurants/{restaurant_id}",
        method=HTTPMethod.DELETE,
        required_scopes=("tenant_admin",),
        description="Delete restaurant and all associated data",
        sensitive=True,
    ),
)


PLATFORM_PERMISSION_RULES: tuple[PlatformPermissionRule, ...] = (
    PlatformPermissionRule(
        resource=PlatformPermissionResource.NOTIFICATIONS_QUEUE,
        action=PlatformPermissionAction.VIEW,
        required_scopes=("ops_viewer", "security_admin"),
        description="View notification queue items and queue metadata.",
    ),
    PlatformPermissionRule(
        resource=PlatformPermissionResource.NOTIFICATIONS_QUEUE,
        action=PlatformPermissionAction.MUTATE,
        required_scopes=("security_admin",),
        description="Assign, read/unread, acknowledge, and snooze notification queue items.",
    ),
    PlatformPermissionRule(
        resource=PlatformPermissionResource.REGISTRATIONS,
        action=PlatformPermissionAction.VIEW,
        required_scopes=("ops_viewer", "tenant_admin"),
        description="View registration queues and registration history.",
    ),
    PlatformPermissionRule(
        resource=PlatformPermissionResource.REGISTRATIONS,
        action=PlatformPermissionAction.REVIEW,
        required_scopes=("tenant_admin",),
        description="Review registration submissions for approval decisions.",
    ),
    PlatformPermissionRule(
        resource=PlatformPermissionResource.REGISTRATIONS,
        action=PlatformPermissionAction.APPROVE,
        required_scopes=("tenant_admin",),
        description="Approve or reject tenant registration submissions.",
    ),
    PlatformPermissionRule(
        resource=PlatformPermissionResource.SETTINGS_REQUESTS,
        action=PlatformPermissionAction.VIEW,
        required_scopes=("ops_viewer", "tenant_admin"),
        description="View pending and reviewed settings request queues.",
    ),
    PlatformPermissionRule(
        resource=PlatformPermissionResource.SETTINGS_REQUESTS,
        action=PlatformPermissionAction.REVIEW,
        required_scopes=("tenant_admin",),
        description="Review tenant settings requests before applying governance decisions.",
    ),
    PlatformPermissionRule(
        resource=PlatformPermissionResource.SETTINGS_REQUESTS,
        action=PlatformPermissionAction.APPROVE,
        required_scopes=("tenant_admin",),
        description="Approve or reject tenant settings requests.",
    ),
    PlatformPermissionRule(
        resource=PlatformPermissionResource.AUDIT_LOGS,
        action=PlatformPermissionAction.VIEW,
        required_scopes=("ops_viewer", "security_admin"),
        description="View platform audit logs and export audit evidence.",
    ),
)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def get_required_scopes_for_endpoint(
    method: str | HTTPMethod, endpoint: str
) -> tuple[str, ...] | None:
    """Get required scopes for a specific endpoint.

    Args:
        method: HTTP method (GET, POST, PATCH, DELETE)
        endpoint: URL endpoint pattern

    Returns:
        Tuple of required scopes, or None if endpoint not found
    """
    if isinstance(method, str):
        try:
            method = HTTPMethod(method.upper())
        except ValueError:
            return None

    for rule in ACCESS_CONTROL_RULES:
        if rule.method == method and rule.endpoint.split()[-1] == endpoint.split()[-1]:
            return rule.required_scopes

    return None


def list_sensitive_endpoints() -> list[AccessRule]:
    """Get all sensitive endpoints that require extra audit logging."""
    return [rule for rule in ACCESS_CONTROL_RULES if rule.sensitive]


def get_endpoints_by_scope(scope: str) -> list[AccessRule]:
    """Get all endpoints accessible with a specific scope.

    Args:
        scope: Scope name (ops_viewer, tenant_admin, billing_admin, security_admin)

    Returns:
        List of access rules for this scope
    """
    return [rule for rule in ACCESS_CONTROL_RULES if scope in rule.required_scopes]


def get_endpoints_by_module(module: str) -> list[AccessRule]:
    """Get all endpoints for a specific module.

    Args:
        module: Module name (auth, audit_logs, packages, subscriptions, users, restaurants)

    Returns:
        List of access rules for this module
    """
    return [rule for rule in ACCESS_CONTROL_RULES if rule.module == module]


def get_required_scopes_for_action(
    resource: str | PlatformPermissionResource,
    action: str | PlatformPermissionAction,
) -> tuple[str, ...] | None:
    """Get required scopes for a high-level action in a protected resource."""
    if isinstance(resource, str):
        try:
            resource = PlatformPermissionResource(resource.strip().lower())
        except ValueError:
            return None

    if isinstance(action, str):
        try:
            action = PlatformPermissionAction(action.strip().lower())
        except ValueError:
            return None

    for rule in PLATFORM_PERMISSION_RULES:
        if rule.resource == resource and rule.action == action:
            return rule.required_scopes

    return None
