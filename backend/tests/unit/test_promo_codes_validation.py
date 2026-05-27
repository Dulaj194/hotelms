import unittest
from datetime import date

from pydantic import ValidationError

from app.modules.promo_codes.schemas import PromoCodeCreateRequest
from app.modules.promo_codes.service import _is_currently_active


class PromoCodesValidationTests(unittest.TestCase):
    def test_create_request_normalizes_code_to_uppercase(self) -> None:
        payload = PromoCodeCreateRequest(
            code=" save8 ",
            discount_percent=8,
            valid_from=date(2026, 1, 1),
            valid_until=date(2026, 12, 31),
        )
        self.assertEqual(payload.code, "SAVE8")

    def test_create_request_rejects_inverted_date_range(self) -> None:
        with self.assertRaises(ValidationError):
            PromoCodeCreateRequest(
                code="SAVE8",
                discount_percent=8,
                valid_from=date(2026, 12, 31),
                valid_until=date(2026, 1, 1),
            )

    def test_is_currently_active_returns_true_within_range(self) -> None:
        self.assertTrue(
            _is_currently_active(
                valid_from=date(2026, 1, 1),
                valid_until=date(2026, 12, 31),
                today=date(2026, 6, 15),
            )
        )

    def test_is_currently_active_returns_false_outside_range(self) -> None:
        self.assertFalse(
            _is_currently_active(
                valid_from=date(2026, 1, 1),
                valid_until=date(2026, 12, 31),
                today=date(2027, 1, 1),
            )
        )


if __name__ == "__main__":
    unittest.main()
