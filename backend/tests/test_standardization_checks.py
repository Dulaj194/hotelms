import unittest
import sys
from pathlib import Path
from unittest.mock import patch

import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.standardization_checks import (  # noqa: E402
    check_schema_drift,
    check_active_track_clarity,
    check_compose_secret_injection,
    check_metadata_naming,
    check_production_guardrails,
    check_router_registration,
)


class _FakeConnectionContext:
    def __init__(self, connection) -> None:
        self._connection = connection

    def __enter__(self):
        return self._connection

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


class _FakeEngine:
    def __init__(self) -> None:
        self._connection = object()

    def connect(self):
        return _FakeConnectionContext(self._connection)

    def dispose(self) -> None:
        return None


class _FakeInspector:
    def __init__(self, table_names: list[str], foreign_keys: dict[str, list[dict]]) -> None:
        self._table_names = table_names
        self._foreign_keys = foreign_keys

    def get_table_names(self) -> list[str]:
        return self._table_names

    def get_foreign_keys(self, table_name: str) -> list[dict]:
        return self._foreign_keys.get(table_name, [])


class StandardizationChecksTests(unittest.TestCase):
    def test_metadata_naming_convention_passes(self) -> None:
        result = check_metadata_naming()
        self.assertTrue(result.ok, "\n".join(result.details))

    def test_module_router_registration_passes(self) -> None:
        result = check_router_registration()
        self.assertTrue(result.ok, "\n".join(result.details))

    def test_compose_secret_injection_passes(self) -> None:
        result = check_compose_secret_injection()
        self.assertTrue(result.ok, "\n".join(result.details))

    def test_active_track_clarity_passes(self) -> None:
        result = check_active_track_clarity()
        self.assertTrue(result.ok, "\n".join(result.details))

    def test_production_guardrails_fail_for_weak_values(self) -> None:
        result = check_production_guardrails(
            app_env="production",
            secret_key="change-this-in-production",
            db_auto_schema_sync=True,
        )
        self.assertFalse(result.ok)
        self.assertGreaterEqual(len(result.details), 1)

    def test_production_guardrails_pass_for_safe_values(self) -> None:
        result = check_production_guardrails(
            app_env="production",
            secret_key="a" * 48,
            db_auto_schema_sync=False,
        )
        self.assertTrue(result.ok, "\n".join(result.details))

    def test_schema_drift_fails_when_expected_foreign_keys_are_missing(self) -> None:
        metadata = sa.MetaData()
        sa.Table("countries", metadata, sa.Column("id", sa.Integer, primary_key=True))
        sa.Table("currency_types", metadata, sa.Column("id", sa.Integer, primary_key=True))
        sa.Table(
            "restaurants",
            metadata,
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("country_id", sa.Integer, sa.ForeignKey("countries.id")),
            sa.Column("currency_id", sa.Integer, sa.ForeignKey("currency_types.id")),
        )

        fake_engine = _FakeEngine()
        fake_inspector = _FakeInspector(
            table_names=["countries", "currency_types", "restaurants"],
            foreign_keys={
                "countries": [],
                "currency_types": [],
                "restaurants": [],
            },
        )

        with (
            patch("scripts.standardization_checks._load_metadata", return_value=metadata),
            patch("scripts.standardization_checks.sa.create_engine", return_value=fake_engine),
            patch("scripts.standardization_checks.sa.inspect", return_value=fake_inspector),
        ):
            result = check_schema_drift("mysql+pymysql://user:pass@localhost:3306/testdb")

        self.assertFalse(result.ok)
        joined_details = "\n".join(result.details)
        self.assertIn("Expected foreign keys: 2", joined_details)
        self.assertIn("Actual foreign keys: 0", joined_details)
        self.assertIn("restaurants(country_id) -> countries(id)", joined_details)
        self.assertIn("restaurants(currency_id) -> currency_types(id)", joined_details)

    def test_schema_drift_passes_when_foreign_keys_match(self) -> None:
        metadata = sa.MetaData()
        sa.Table("countries", metadata, sa.Column("id", sa.Integer, primary_key=True))
        sa.Table("currency_types", metadata, sa.Column("id", sa.Integer, primary_key=True))
        sa.Table(
            "restaurants",
            metadata,
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("country_id", sa.Integer, sa.ForeignKey("countries.id")),
            sa.Column("currency_id", sa.Integer, sa.ForeignKey("currency_types.id")),
        )

        fake_engine = _FakeEngine()
        fake_inspector = _FakeInspector(
            table_names=["countries", "currency_types", "restaurants"],
            foreign_keys={
                "countries": [],
                "currency_types": [],
                "restaurants": [
                    {
                        "constrained_columns": ["country_id"],
                        "referred_table": "countries",
                        "referred_columns": ["id"],
                    },
                    {
                        "constrained_columns": ["currency_id"],
                        "referred_table": "currency_types",
                        "referred_columns": ["id"],
                    },
                ],
            },
        )

        with (
            patch("scripts.standardization_checks._load_metadata", return_value=metadata),
            patch("scripts.standardization_checks.sa.create_engine", return_value=fake_engine),
            patch("scripts.standardization_checks.sa.inspect", return_value=fake_inspector),
        ):
            result = check_schema_drift("mysql+pymysql://user:pass@localhost:3306/testdb")

        self.assertTrue(result.ok, "\n".join(result.details))


if __name__ == "__main__":
    unittest.main()
