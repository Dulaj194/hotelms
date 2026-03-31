import unittest
from datetime import date, timedelta
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException

from app.modules.reports.service import _normalize_date_range, resolve_month_date_range


class ReportsDateRangeTests(unittest.TestCase):
    def test_single_defaults_to_today_when_missing_date(self) -> None:
        filter_type, selected_date, from_date, to_date = _normalize_date_range(
            "single",
            selected_date=None,
            from_date=None,
            to_date=None,
        )
        self.assertEqual(filter_type, "single")
        self.assertIsNotNone(selected_date)
        self.assertIsNone(from_date)
        self.assertIsNone(to_date)

    def test_invalid_filter_type_raises(self) -> None:
        with self.assertRaises(HTTPException):
            _normalize_date_range("weekly", None, None, None)

    def test_range_over_limit_raises(self) -> None:
        start = date(2026, 1, 1)
        end = start + timedelta(days=367)
        with self.assertRaises(HTTPException):
            _normalize_date_range("range", None, start, end)

    def test_month_range_resolution_for_feb_leap_year(self) -> None:
        from_date, to_date = resolve_month_date_range(2024, 2)
        self.assertEqual(from_date, date(2024, 2, 1))
        self.assertEqual(to_date, date(2024, 2, 29))

    def test_month_range_rejects_invalid_month(self) -> None:
        with self.assertRaises(HTTPException):
            resolve_month_date_range(2026, 13)


if __name__ == "__main__":
    unittest.main()
