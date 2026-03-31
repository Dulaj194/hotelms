import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.modules.restaurants.service import (  # noqa: E402
    _apply_billing_email_defaults,
    _effective_billing_email,
)


class RestaurantBillingEmailDefaultsTests(unittest.TestCase):
    def test_effective_billing_email_falls_back_to_primary_email(self) -> None:
        self.assertEqual(
            _effective_billing_email(
                primary_email="owner@example.com",
                billing_email=None,
            ),
            "owner@example.com",
        )

    def test_create_defaults_billing_email_to_primary_email(self) -> None:
        result = _apply_billing_email_defaults(
            {"name": "Milano", "email": "owner@example.com"}
        )
        self.assertEqual(result["billing_email"], "owner@example.com")

    def test_email_change_keeps_synced_billing_email_updated(self) -> None:
        result = _apply_billing_email_defaults(
            {"email": "billing-new@example.com"},
            existing_primary_email="billing-old@example.com",
            existing_billing_email="billing-old@example.com",
        )
        self.assertEqual(result["billing_email"], "billing-new@example.com")

    def test_email_change_preserves_custom_billing_email(self) -> None:
        result = _apply_billing_email_defaults(
            {"email": "owner-new@example.com"},
            existing_primary_email="owner-old@example.com",
            existing_billing_email="accounts@example.com",
        )
        self.assertNotIn("billing_email", result)

    def test_blank_billing_email_reuses_primary_email(self) -> None:
        result = _apply_billing_email_defaults(
            {"email": "owner@example.com", "billing_email": None},
            existing_primary_email="old@example.com",
            existing_billing_email="old@example.com",
        )
        self.assertEqual(result["billing_email"], "owner@example.com")


if __name__ == "__main__":
    unittest.main()
