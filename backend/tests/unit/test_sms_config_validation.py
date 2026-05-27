import sys
import unittest
from pathlib import Path

from pydantic import ValidationError

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import Settings  # noqa: E402


class SmsConfigValidationTests(unittest.TestCase):
    def test_sms_disabled_allows_missing_twilio_fields(self) -> None:
        configured = Settings(
            _env_file=None,
            sms_enabled=False,
            twilio_account_sid="",
            twilio_auth_token="",
            twilio_from_number="",
        )

        self.assertFalse(configured.sms_enabled)

    def test_sms_enabled_requires_twilio_provider(self) -> None:
        with self.assertRaises(ValidationError) as ctx:
            Settings(
                _env_file=None,
                sms_enabled=True,
                sms_provider="custom-provider",
                twilio_account_sid="AC1234567890",
                twilio_auth_token="token",
                twilio_from_number="+14155552671",
            )

        self.assertIn("SMS_PROVIDER", str(ctx.exception))

    def test_sms_enabled_requires_twilio_fields(self) -> None:
        with self.assertRaises(ValidationError) as ctx:
            Settings(
                _env_file=None,
                sms_enabled=True,
                sms_provider="twilio",
                twilio_account_sid="",
                twilio_auth_token="",
                twilio_from_number="",
            )

        error_text = str(ctx.exception)
        self.assertIn("TWILIO_ACCOUNT_SID", error_text)
        self.assertIn("TWILIO_AUTH_TOKEN", error_text)
        self.assertIn("TWILIO_FROM_NUMBER", error_text)

    def test_sms_enabled_requires_ac_prefixed_sid(self) -> None:
        with self.assertRaises(ValidationError) as ctx:
            Settings(
                _env_file=None,
                sms_enabled=True,
                sms_provider="twilio",
                twilio_account_sid="ZZ1234567890",
                twilio_auth_token="token",
                twilio_from_number="+14155552671",
            )

        self.assertIn("must start with 'AC'", str(ctx.exception))

    def test_sms_enabled_requires_e164_sender_number(self) -> None:
        with self.assertRaises(ValidationError) as ctx:
            Settings(
                _env_file=None,
                sms_enabled=True,
                sms_provider="twilio",
                twilio_account_sid="AC1234567890",
                twilio_auth_token="token",
                twilio_from_number="0711234567",
            )

        self.assertIn("E.164", str(ctx.exception))

    def test_sms_values_are_normalized(self) -> None:
        configured = Settings(
            _env_file=None,
            sms_enabled=True,
            sms_provider="  TwILIO  ",
            sms_default_country_code="94",
            twilio_account_sid="AC1234567890",
            twilio_auth_token="token",
            twilio_from_number=" +14155552671 ",
        )

        self.assertEqual(configured.sms_provider, "twilio")
        self.assertEqual(configured.sms_default_country_code, "+94")
        self.assertEqual(configured.twilio_from_number, "+14155552671")


if __name__ == "__main__":
    unittest.main()
