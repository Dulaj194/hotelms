import unittest
import sys
import os
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from jose import JWTError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.chdir(Path(__file__).resolve().parents[1])

from app.modules.realtime.router import (
    _is_ws_user_access_valid,
    _user_can_access_kitchen_stream,
    _validate_ws_token,
)


class RealtimeWebSocketAuthTests(unittest.TestCase):
    def _build_user(
        self,
        *,
        user_id: int = 10,
        role: str = "steward",
        restaurant_id: int | None = 5,
        is_active: bool = True,
        must_change_password: bool = False,
    ) -> SimpleNamespace:
        return SimpleNamespace(
            id=user_id,
            role=SimpleNamespace(value=role),
            restaurant_id=restaurant_id,
            is_active=is_active,
            must_change_password=must_change_password,
        )

    def test_accepts_active_restaurant_user_with_valid_access_token(self) -> None:
        payload = {
            "type": "access",
            "sub": "10",
            "role": "steward",
            "restaurant_id": 5,
        }
        user = self._build_user()

        with (
            patch("app.modules.realtime.router.decode_token", return_value=payload),
            patch("app.modules.realtime.router.get_by_id_global", return_value=user),
        ):
            result = _validate_ws_token("token", restaurant_id=5, db=SimpleNamespace())

        self.assertEqual(result, {"user_id": 10, "role": "steward"})

    def test_rejects_when_user_is_inactive(self) -> None:
        payload = {"type": "access", "sub": "10", "role": "steward", "restaurant_id": 5}
        user = self._build_user(is_active=False)

        with (
            patch("app.modules.realtime.router.decode_token", return_value=payload),
            patch("app.modules.realtime.router.get_by_id_global", return_value=user),
        ):
            result = _validate_ws_token("token", restaurant_id=5, db=SimpleNamespace())

        self.assertIsNone(result)

    def test_rejects_cross_tenant_connection(self) -> None:
        payload = {"type": "access", "sub": "10", "role": "steward", "restaurant_id": 5}
        user = self._build_user(restaurant_id=99)

        with (
            patch("app.modules.realtime.router.decode_token", return_value=payload),
            patch("app.modules.realtime.router.get_by_id_global", return_value=user),
        ):
            result = _validate_ws_token("token", restaurant_id=5, db=SimpleNamespace())

        self.assertIsNone(result)

    def test_rejects_when_password_change_is_required(self) -> None:
        payload = {"type": "access", "sub": "10", "role": "steward", "restaurant_id": 5}
        user = self._build_user(must_change_password=True)

        with (
            patch("app.modules.realtime.router.decode_token", return_value=payload),
            patch("app.modules.realtime.router.get_by_id_global", return_value=user),
        ):
            result = _validate_ws_token("token", restaurant_id=5, db=SimpleNamespace())

        self.assertIsNone(result)

    def test_rejects_when_token_role_claim_mismatches_db_role(self) -> None:
        payload = {"type": "access", "sub": "10", "role": "admin", "restaurant_id": 5}
        user = self._build_user(role="steward")

        with (
            patch("app.modules.realtime.router.decode_token", return_value=payload),
            patch("app.modules.realtime.router.get_by_id_global", return_value=user),
        ):
            result = _validate_ws_token("token", restaurant_id=5, db=SimpleNamespace())

        self.assertIsNone(result)

    def test_rejects_when_decode_fails(self) -> None:
        with patch("app.modules.realtime.router.decode_token", side_effect=JWTError("bad token")):
            result = _validate_ws_token("token", restaurant_id=5, db=SimpleNamespace())

        self.assertIsNone(result)

    def test_user_can_access_helper_accepts_valid_user(self) -> None:
        user = self._build_user()
        self.assertTrue(_user_can_access_kitchen_stream(user, restaurant_id=5))

    def test_user_can_access_helper_rejects_wrong_role(self) -> None:
        user = self._build_user(role="housekeeper")
        self.assertFalse(_user_can_access_kitchen_stream(user, restaurant_id=5))

    def test_ws_user_access_validator_rechecks_db_state(self) -> None:
        user = self._build_user(is_active=False)
        fake_db = SimpleNamespace(close=lambda: None)

        with (
            patch("app.modules.realtime.router.SessionLocal", return_value=fake_db),
            patch("app.modules.realtime.router.get_by_id_global", return_value=user),
        ):
            result = _is_ws_user_access_valid(user_id=10, restaurant_id=5)

        self.assertFalse(result)
