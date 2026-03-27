import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.db.init_models  # noqa: F401
from app.db.base import Base


class ModelRegistryTests(unittest.TestCase):
    def test_reports_history_table_is_registered(self) -> None:
        self.assertIn("reports_history", Base.metadata.tables.keys())

    def test_settings_requests_table_is_registered(self) -> None:
        self.assertIn("settings_requests", Base.metadata.tables.keys())


if __name__ == "__main__":
    unittest.main()
