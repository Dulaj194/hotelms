import unittest
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.modules.subscriptions.model import SubscriptionStatus  # noqa: E402
from app.modules.subscriptions.service import (  # noqa: E402
    _effective_status,
    _normalize_datetime,
)


class SubscriptionTimezoneNormalizationTests(unittest.TestCase):
    def test_normalize_datetime_converts_aware_value_to_naive_utc(self) -> None:
        source = datetime(2026, 3, 31, 12, 0, tzinfo=timezone(timedelta(hours=5, minutes=30)))
        normalized = _normalize_datetime(source)

        self.assertEqual(normalized, datetime(2026, 3, 31, 6, 30))
        self.assertIsNone(normalized.tzinfo)

    def test_normalize_datetime_keeps_naive_value_unchanged(self) -> None:
        source = datetime(2026, 3, 31, 12, 0)
        normalized = _normalize_datetime(source)

        self.assertEqual(normalized, source)
        self.assertIsNone(normalized.tzinfo)

    def test_effective_status_uses_normalized_utc_for_aware_expiry(self) -> None:
        now_utc = datetime(2026, 3, 31, 7, 0, 0)
        sub = _SubscriptionStub(
            status=SubscriptionStatus.active,
            is_trial=False,
            expires_at=datetime(
                2026,
                3,
                31,
                12,
                0,
                0,
                tzinfo=timezone(timedelta(hours=5, minutes=30)),
            ),
            trial_expires_at=None,
        )

        with patch("app.modules.subscriptions.service._utcnow_naive", return_value=now_utc):
            status_value = _effective_status(sub)

        self.assertEqual(status_value, SubscriptionStatus.expired.value)


class _SubscriptionStub:
    def __init__(
        self,
        *,
        status: SubscriptionStatus,
        is_trial: bool,
        expires_at: datetime | None,
        trial_expires_at: datetime | None,
    ) -> None:
        self.status = status
        self.is_trial = is_trial
        self.expires_at = expires_at
        self.trial_expires_at = trial_expires_at


if __name__ == "__main__":
    unittest.main()
