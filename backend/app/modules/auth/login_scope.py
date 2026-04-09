from __future__ import annotations

from dataclasses import dataclass

from app.modules.access import role_catalog
from app.modules.users.model import UserRole


RESTAURANT_ADMIN_LOGIN_ROLES = frozenset(role_catalog.RESTAURANT_ADMIN_ROLES)
STAFF_LOGIN_ROLES = frozenset(role_catalog.RESTAURANT_STAFF_LOGIN_ROLES)
SUPER_ADMIN_LOGIN_ROLES = frozenset({UserRole.super_admin})


@dataclass(frozen=True)
class LoginScopePolicy:
    scope_key: str
    allowed_roles: frozenset[UserRole] | None
    require_restaurant_context: bool


GENERAL_LOGIN_SCOPE = LoginScopePolicy(
    scope_key="general",
    allowed_roles=None,
    require_restaurant_context=False,
)

RESTAURANT_ADMIN_LOGIN_SCOPE = LoginScopePolicy(
    scope_key="restaurant_admin",
    allowed_roles=RESTAURANT_ADMIN_LOGIN_ROLES,
    require_restaurant_context=True,
)

STAFF_LOGIN_SCOPE = LoginScopePolicy(
    scope_key="staff",
    allowed_roles=STAFF_LOGIN_ROLES,
    require_restaurant_context=True,
)

SUPER_ADMIN_LOGIN_SCOPE = LoginScopePolicy(
    scope_key="super_admin",
    allowed_roles=SUPER_ADMIN_LOGIN_ROLES,
    require_restaurant_context=False,
)


def is_login_scope_allowed(
    *,
    user_role: UserRole,
    user_restaurant_id: int | None,
    allowed_roles: frozenset[UserRole] | set[UserRole] | None,
    require_restaurant_context: bool,
) -> bool:
    if allowed_roles is not None and user_role not in allowed_roles:
        return False
    if require_restaurant_context and user_restaurant_id is None:
        return False
    return True
