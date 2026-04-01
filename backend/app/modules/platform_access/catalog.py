from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class PlatformScopeDefinition:
    key: str
    label: str
    description: str
    default_path: str


_PLATFORM_SCOPE_DEFINITIONS = {
    "ops_viewer": PlatformScopeDefinition(
        key="ops_viewer",
        label="Ops Viewer",
        description="Read platform dashboards, notifications, histories, and audit visibility.",
        default_path="/super-admin",
    ),
    "tenant_admin": PlatformScopeDefinition(
        key="tenant_admin",
        label="Tenant Admin",
        description="Manage hotel onboarding, tenant profiles, settings reviews, and hotel staff.",
        default_path="/super-admin/registrations",
    ),
    "billing_admin": PlatformScopeDefinition(
        key="billing_admin",
        label="Billing Admin",
        description="Manage packages, promo codes, and hotel subscription assignments.",
        default_path="/super-admin/packages",
    ),
    "security_admin": PlatformScopeDefinition(
        key="security_admin",
        label="Security Admin",
        description="Manage platform users, audit visibility, and integration credentials.",
        default_path="/super-admin/platform-users",
    ),
}

DEFAULT_PLATFORM_SCOPES: tuple[str, ...] = tuple(_PLATFORM_SCOPE_DEFINITIONS.keys())


def list_platform_scope_definitions() -> list[PlatformScopeDefinition]:
    return list(_PLATFORM_SCOPE_DEFINITIONS.values())


def get_platform_scope_definition(value: str) -> PlatformScopeDefinition | None:
    return _PLATFORM_SCOPE_DEFINITIONS.get(value.strip().lower())


def normalize_platform_scopes(values: Iterable[str] | None) -> list[str]:
    if values is None:
        return list(DEFAULT_PLATFORM_SCOPES)

    normalized: list[str] = []
    for value in values:
        definition = get_platform_scope_definition(str(value))
        if definition is None or definition.key in normalized:
            continue
        normalized.append(definition.key)

    return normalized


def parse_platform_scopes_json(raw_value: str | None) -> list[str]:
    if not raw_value:
        return list(DEFAULT_PLATFORM_SCOPES)

    try:
        parsed = json.loads(raw_value)
    except Exception:
        return list(DEFAULT_PLATFORM_SCOPES)

    if not isinstance(parsed, list):
        return list(DEFAULT_PLATFORM_SCOPES)

    return normalize_platform_scopes([str(item) for item in parsed])


def serialize_platform_scopes(values: Iterable[str] | None) -> str:
    return json.dumps(normalize_platform_scopes(values))


def get_user_platform_scopes(user: object) -> list[str]:
    role_obj = getattr(user, "role", None)
    role = role_obj.value if hasattr(role_obj, "value") else str(role_obj)
    if role != "super_admin":
        return []

    raw_value = getattr(user, "platform_scopes_json", None)
    return parse_platform_scopes_json(raw_value)


def user_has_any_platform_scope(
    user: object,
    required_scopes: Iterable[str],
) -> bool:
    user_scopes = set(get_user_platform_scopes(user))
    if not user_scopes:
        return False
    normalized_required = set(normalize_platform_scopes(required_scopes))
    return bool(user_scopes & normalized_required)
