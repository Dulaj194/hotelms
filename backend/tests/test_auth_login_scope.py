import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.modules.auth.login_scope import (  # noqa: E402
    RESTAURANT_ADMIN_LOGIN_ROLES,
    STAFF_LOGIN_ROLES,
    SUPER_ADMIN_LOGIN_ROLES,
    is_login_scope_allowed,
)
from app.modules.users.model import UserRole  # noqa: E402


class AuthLoginScopeTests(unittest.TestCase):
    def test_restaurant_admin_scope_allows_owner_with_tenant_context(self) -> None:
        self.assertTrue(
            is_login_scope_allowed(
                user_role=UserRole.owner,
                user_restaurant_id=7,
                allowed_roles=RESTAURANT_ADMIN_LOGIN_ROLES,
                require_restaurant_context=True,
            )
        )

    def test_restaurant_admin_scope_rejects_staff_role(self) -> None:
        self.assertFalse(
            is_login_scope_allowed(
                user_role=UserRole.steward,
                user_restaurant_id=7,
                allowed_roles=RESTAURANT_ADMIN_LOGIN_ROLES,
                require_restaurant_context=True,
            )
        )

    def test_staff_scope_rejects_missing_restaurant_context(self) -> None:
        self.assertFalse(
            is_login_scope_allowed(
                user_role=UserRole.housekeeper,
                user_restaurant_id=None,
                allowed_roles=STAFF_LOGIN_ROLES,
                require_restaurant_context=True,
            )
        )

    def test_super_admin_scope_allows_platform_user_without_restaurant_context(self) -> None:
        self.assertTrue(
            is_login_scope_allowed(
                user_role=UserRole.super_admin,
                user_restaurant_id=None,
                allowed_roles=SUPER_ADMIN_LOGIN_ROLES,
                require_restaurant_context=False,
            )
        )

    def test_super_admin_scope_rejects_restaurant_admin_role(self) -> None:
        self.assertFalse(
            is_login_scope_allowed(
                user_role=UserRole.admin,
                user_restaurant_id=10,
                allowed_roles=SUPER_ADMIN_LOGIN_ROLES,
                require_restaurant_context=False,
            )
        )


if __name__ == "__main__":
    unittest.main()
