import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.standardization_checks import (  # noqa: E402
    check_compose_secret_injection,
    check_metadata_naming,
    check_production_guardrails,
    check_router_registration,
)


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


if __name__ == "__main__":
    unittest.main()

