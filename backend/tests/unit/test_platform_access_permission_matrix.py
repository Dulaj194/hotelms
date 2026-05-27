import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

from fastapi import HTTPException, status


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.core.dependencies import require_platform_action  # noqa: E402
from app.modules.platform_access import matrix as platform_access_matrix  # noqa: E402
from app.modules.users.model import UserRole  # noqa: E402


class PlatformAccessPermissionMatrixTests(unittest.TestCase):
    @staticmethod
    def _build_super_admin(scopes: list[str]) -> SimpleNamespace:
        return SimpleNamespace(
            role=UserRole.super_admin,
            platform_scopes_json=json.dumps(scopes),
        )

    def test_notifications_mutate_scope_is_security_admin_only(self) -> None:
        self.assertEqual(
            platform_access_matrix.get_required_scopes_for_action(
                "notifications_queue",
                "mutate",
            ),
            ("security_admin",),
        )

    def test_unknown_action_lookup_is_fail_closed(self) -> None:
        self.assertIsNone(
            platform_access_matrix.get_required_scopes_for_action(
                "notifications_queue",
                "archive",
            ),
        )
        self.assertIsNone(
            platform_access_matrix.get_required_scopes_for_action(
                "unknown_resource",
                "view",
            ),
        )

    def test_require_platform_action_blocks_ops_viewer_notification_mutation(self) -> None:
        dependency = require_platform_action("notifications_queue", "mutate")

        with self.assertRaises(HTTPException) as context:
            dependency(current_user=self._build_super_admin(["ops_viewer"]))

        self.assertEqual(context.exception.status_code, status.HTTP_403_FORBIDDEN)

    def test_require_platform_action_allows_security_admin_notification_mutation(self) -> None:
        dependency = require_platform_action("notifications_queue", "mutate")
        current_user = self._build_super_admin(["security_admin"])

        resolved = dependency(current_user=current_user)

        self.assertIs(resolved, current_user)

    def test_require_platform_action_allows_ops_viewer_registration_view(self) -> None:
        dependency = require_platform_action("registrations", "view")
        current_user = self._build_super_admin(["ops_viewer"])

        resolved = dependency(current_user=current_user)

        self.assertIs(resolved, current_user)


if __name__ == "__main__":
    unittest.main()
