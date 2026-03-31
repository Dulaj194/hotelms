import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.security import create_table_qr_access_token, decode_table_qr_access_token  # noqa: E402
from app.modules.table_sessions import service  # noqa: E402
from app.modules.table_sessions.schemas import TableSessionStartRequest  # noqa: E402


class _FakeDb:
    def __init__(self) -> None:
        self.committed = False
        self.rolled_back = False

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True


class TableSessionQrSecurityTests(unittest.TestCase):
    def test_table_qr_token_roundtrip(self) -> None:
        token = create_table_qr_access_token(
            restaurant_id=7,
            table_number="A12",
            expire_days=7,
        )

        payload = decode_table_qr_access_token(token)

        self.assertEqual(payload["type"], "table_qr_access")
        self.assertEqual(payload["restaurant_id"], 7)
        self.assertEqual(payload["table_number"], "A12")

    def test_start_table_session_rejects_invalid_qr_credential(self) -> None:
        db = _FakeDb()
        data = TableSessionStartRequest(
            restaurant_id=1,
            table_number="T1",
            qr_access_key="x" * 32,
        )

        with (
            patch(
                "app.modules.table_sessions.service.get_restaurant",
                return_value=SimpleNamespace(is_active=True),
            ),
            patch(
                "app.modules.table_sessions.service.decode_table_qr_access_token",
                side_effect=ValueError("bad token"),
            ),
        ):
            with self.assertRaises(HTTPException) as ctx:
                service.start_table_session(db, data)

        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("Invalid or expired table QR credential", str(ctx.exception.detail))
        self.assertFalse(db.committed)

    def test_start_table_session_rejects_mismatched_qr_context(self) -> None:
        db = _FakeDb()
        data = TableSessionStartRequest(
            restaurant_id=10,
            table_number="T2",
            qr_access_key="x" * 32,
        )

        with (
            patch(
                "app.modules.table_sessions.service.get_restaurant",
                return_value=SimpleNamespace(is_active=True),
            ),
            patch(
                "app.modules.table_sessions.service.decode_table_qr_access_token",
                return_value={"restaurant_id": 10, "table_number": "OTHER"},
            ),
        ):
            with self.assertRaises(HTTPException) as ctx:
                service.start_table_session(db, data)

        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("does not match this table context", str(ctx.exception.detail))
        self.assertFalse(db.committed)

    def test_start_table_session_accepts_valid_qr_context(self) -> None:
        db = _FakeDb()
        data = TableSessionStartRequest(
            restaurant_id=3,
            table_number=" A9 ",
            qr_access_key="x" * 32,
        )

        with (
            patch(
                "app.modules.table_sessions.service.get_restaurant",
                return_value=SimpleNamespace(is_active=True),
            ),
            patch(
                "app.modules.table_sessions.service.decode_table_qr_access_token",
                return_value={"restaurant_id": 3, "table_number": "A9"},
            ),
            patch("app.modules.table_sessions.service.repository.deactivate_active_sessions_for_table") as deactivate,
            patch("app.modules.table_sessions.service.repository.create_session") as create_session,
            patch(
                "app.modules.table_sessions.service.create_guest_session_token",
                return_value="guest-token",
            ),
        ):
            response = service.start_table_session(db, data)

        self.assertTrue(db.committed)
        self.assertEqual(response.guest_token, "guest-token")
        self.assertEqual(response.table_number, "A9")
        deactivate.assert_called_once()
        create_session.assert_called_once()
        self.assertEqual(deactivate.call_args.kwargs["table_number"], "A9")
        self.assertEqual(create_session.call_args.kwargs["table_number"], "A9")


if __name__ == "__main__":
    unittest.main()
