import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.db.init_models  # noqa: F401
from app.db.base import Base


class ModelRegistryTests(unittest.TestCase):
    def test_reports_history_table_is_registered(self) -> None:
        self.assertIn("reports_history", Base.metadata.tables.keys())

    def test_settings_requests_table_is_registered(self) -> None:
        self.assertIn("settings_requests", Base.metadata.tables.keys())

    def test_reference_data_tables_are_registered(self) -> None:
        self.assertIn("countries", Base.metadata.tables.keys())
        self.assertIn("currency_types", Base.metadata.tables.keys())

    def test_promo_code_tables_are_registered(self) -> None:
        self.assertIn("promo_codes", Base.metadata.tables.keys())
        self.assertIn("promo_code_usages", Base.metadata.tables.keys())

    def test_subcategory_table_is_not_registered(self) -> None:
        self.assertNotIn("subcategories", Base.metadata.tables.keys())


if __name__ == "__main__":
    unittest.main()
