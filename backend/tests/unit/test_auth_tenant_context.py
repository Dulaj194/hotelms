import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.modules.auth import service  # noqa: E402


class AuthTenantContextTests(unittest.TestCase):
    def test_returns_zero_counts_for_user_without_restaurant_context(self) -> None:
        user = SimpleNamespace(
            id=1,
            email="super.admin@example.com",
            role=SimpleNamespace(value="super_admin"),
            restaurant_id=None,
        )

        snapshot = service.get_tenant_context_snapshot(SimpleNamespace(), user)

        self.assertIsNone(snapshot.restaurant_id)
        self.assertEqual(snapshot.counts.menus, 0)
        self.assertEqual(snapshot.counts.categories, 0)
        self.assertEqual(snapshot.counts.items, 0)
        self.assertIsNotNone(snapshot.note)

    def test_returns_tenant_counts_for_restaurant_bound_user(self) -> None:
        user = SimpleNamespace(
            id=7,
            email="owner@example.com",
            role=SimpleNamespace(value="owner"),
            restaurant_id=12,
        )

        with (
            patch("app.modules.auth.service._get_restaurant_name", return_value="Milano"),
            patch("app.modules.auth.service._count_model_rows", side_effect=[6, 5, 23]),
        ):
            snapshot = service.get_tenant_context_snapshot(SimpleNamespace(), user)

        self.assertEqual(snapshot.user_id, 7)
        self.assertEqual(snapshot.restaurant_id, 12)
        self.assertEqual(snapshot.restaurant_name, "Milano")
        self.assertEqual(snapshot.counts.menus, 6)
        self.assertEqual(snapshot.counts.categories, 5)
        self.assertEqual(snapshot.counts.items, 23)
        self.assertIsNone(snapshot.note)


if __name__ == "__main__":
    unittest.main()
