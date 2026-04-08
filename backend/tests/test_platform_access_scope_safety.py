import sys
import unittest
from pathlib import Path
from types import SimpleNamespace


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.modules.platform_access import catalog as platform_access_catalog  # noqa: E402


class PlatformAccessScopeSafetyTests(unittest.TestCase):
    def test_parse_missing_scope_payload_is_fail_closed(self) -> None:
        self.assertEqual(
            platform_access_catalog.parse_platform_scopes_json(None),
            [],
        )
        self.assertEqual(
            platform_access_catalog.parse_platform_scopes_json(""),
            [],
        )

    def test_parse_invalid_scope_payload_is_fail_closed(self) -> None:
        self.assertEqual(
            platform_access_catalog.parse_platform_scopes_json("{not-json"),
            [],
        )
        self.assertEqual(
            platform_access_catalog.parse_platform_scopes_json('{"scope":"ops_viewer"}'),
            [],
        )

    def test_parse_unknown_scope_values_are_dropped(self) -> None:
        self.assertEqual(
            platform_access_catalog.parse_platform_scopes_json('["invalid_scope"]'),
            [],
        )
        self.assertEqual(
            platform_access_catalog.parse_platform_scopes_json(
                '["OPS_VIEWER", "tenant_admin", "ops_viewer", "unknown"]'
            ),
            ["ops_viewer", "tenant_admin"],
        )

    def test_serialize_none_scope_payload_stores_empty_list(self) -> None:
        self.assertEqual(
            platform_access_catalog.serialize_platform_scopes(None),
            "[]",
        )

    def test_user_scope_resolution_is_fail_closed_for_missing_payload(self) -> None:
        user = SimpleNamespace(
            role=SimpleNamespace(value="super_admin"),
            platform_scopes_json=None,
        )
        self.assertEqual(platform_access_catalog.get_user_platform_scopes(user), [])
        self.assertFalse(
            platform_access_catalog.user_has_any_platform_scope(user, ("ops_viewer",)),
        )

    def test_user_scope_resolution_respects_valid_payload(self) -> None:
        user = SimpleNamespace(
            role=SimpleNamespace(value="super_admin"),
            platform_scopes_json='["ops_viewer", "security_admin"]',
        )
        self.assertEqual(
            platform_access_catalog.get_user_platform_scopes(user),
            ["ops_viewer", "security_admin"],
        )
        self.assertTrue(
            platform_access_catalog.user_has_any_platform_scope(user, ("security_admin",)),
        )


if __name__ == "__main__":
    unittest.main()
