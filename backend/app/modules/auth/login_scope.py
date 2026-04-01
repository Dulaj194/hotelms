from __future__ import annotations

from app.modules.users.model import UserRole

RESTAURANT_ADMIN_LOGIN_ROLES = {UserRole.owner, UserRole.admin}
STAFF_LOGIN_ROLES = {
    UserRole.steward,
    UserRole.housekeeper,
    UserRole.cashier,
    UserRole.accountant,
}
SUPER_ADMIN_LOGIN_ROLES = {UserRole.super_admin}


def is_login_scope_allowed(
    *,
    user_role: UserRole,
    user_restaurant_id: int | None,
    allowed_roles: set[UserRole] | None,
    require_restaurant_context: bool,
) -> bool:
    if allowed_roles is not None and user_role not in allowed_roles:
        return False
    if require_restaurant_context and user_restaurant_id is None:
        return False
    return True
