import sys
import unittest
from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.modules.qr import service  # noqa: E402


class QRServiceTests(unittest.TestCase):
    def test_list_table_qr_returns_table_scoped_results(self) -> None:
        created_at = datetime(2026, 3, 31, 8, 30, tzinfo=UTC)
        record = SimpleNamespace(
            qr_type="table",
            target_number="12",
            frontend_url="https://example.com/menu/1/table/12?k=token",
            file_path="qr_1_table_12.png",
            created_at=created_at,
        )

        with patch(
            "app.modules.qr.service.repository.list_qr_by_type",
            return_value=[record],
        ) as list_qr_by_type:
            response = service.list_table_qr(object(), 9)

        list_qr_by_type.assert_called_once_with(unittest.mock.ANY, 9, "table")
        self.assertEqual(response.total, 1)
        self.assertEqual(response.qrcodes[0].target_number, "12")
        self.assertEqual(response.qrcodes[0].created_at, created_at)

    def test_delete_table_qr_removes_file_and_returns_message(self) -> None:
        with TemporaryDirectory() as tmp_dir:
            qr_file = Path(tmp_dir) / "qr_9_table_12.png"
            qr_file.write_bytes(b"qr")
            deleted_record = SimpleNamespace(file_path=str(qr_file))

            with patch(
                "app.modules.qr.service.repository.delete_qr",
                return_value=deleted_record,
            ) as delete_qr:
                response = service.delete_table_qr(object(), 9, " 12 ")

        delete_qr.assert_called_once_with(unittest.mock.ANY, 9, "table", "12")
        self.assertEqual(response.message, "Table QR '12' deleted.")
        self.assertFalse(qr_file.exists())

    def test_delete_table_qr_rejects_blank_number(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            service.delete_table_qr(object(), 5, "   ")

        self.assertEqual(ctx.exception.status_code, 422)
        self.assertEqual(ctx.exception.detail, "Table number is required.")

    def test_delete_all_table_qr_removes_all_files(self) -> None:
        with TemporaryDirectory() as tmp_dir:
            first_file = Path(tmp_dir) / "first.png"
            second_file = Path(tmp_dir) / "second.png"
            first_file.write_bytes(b"1")
            second_file.write_bytes(b"2")
            deleted_records = [
                SimpleNamespace(file_path=str(first_file)),
                SimpleNamespace(file_path=str(second_file)),
            ]

            with patch(
                "app.modules.qr.service.repository.delete_qr_by_type",
                return_value=deleted_records,
            ) as delete_qr_by_type:
                response = service.delete_all_table_qr(object(), 4)

        delete_qr_by_type.assert_called_once_with(unittest.mock.ANY, 4, "table")
        self.assertEqual(response.message, "Deleted 2 table QR code(s).")
        self.assertFalse(first_file.exists())
        self.assertFalse(second_file.exists())


if __name__ == "__main__":
    unittest.main()
