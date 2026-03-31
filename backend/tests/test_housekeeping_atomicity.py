import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.modules.housekeeping import service  # noqa: E402
from app.modules.housekeeping.schemas import HousekeepingRequestCreateRequest  # noqa: E402


class _FakeDb:
    def __init__(self) -> None:
        self.commit_calls = 0
        self.rollback_calls = 0

    def commit(self) -> None:
        self.commit_calls += 1

    def rollback(self) -> None:
        self.rollback_calls += 1


class HousekeepingAtomicityTests(unittest.TestCase):
    def _build_room_session(self) -> SimpleNamespace:
        return SimpleNamespace(
            restaurant_id=11,
            room_id=22,
            session_id="room-session-1",
            room_number_snapshot="R-101",
        )

    def _build_request_entity(self) -> SimpleNamespace:
        return SimpleNamespace(
            id=9001,
            restaurant_id=11,
            room_id=22,
            room_number_snapshot="R-101",
            request_type="cleaning",
            message="Need cleaning",
            priority="normal",
            requested_for_at=None,
            due_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            audio_url=None,
            status="pending_assignment",
            submitted_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )

    def test_submit_request_commits_once_on_success(self) -> None:
        db = _FakeDb()
        payload = HousekeepingRequestCreateRequest(
            request_type="cleaning",
            message="Need cleaning",
        )
        room_session = self._build_room_session()
        req_entity = self._build_request_entity()

        with (
            patch(
                "app.modules.housekeeping.service._cleanup_old_requests_for_restaurant",
                return_value=0,
            ),
            patch(
                "app.modules.housekeeping.service.repository.create_housekeeping_request",
                return_value=req_entity,
            ),
            patch("app.modules.housekeeping.service._append_event"),
            patch("app.modules.housekeeping.service._set_room_status"),
        ):
            response = service.submit_request(db, room_session, payload)

        self.assertEqual(db.commit_calls, 1)
        self.assertEqual(db.rollback_calls, 0)
        self.assertEqual(response.id, 9001)
        self.assertEqual(response.status, "pending_assignment")

    def test_submit_request_rolls_back_when_step_fails(self) -> None:
        db = _FakeDb()
        payload = HousekeepingRequestCreateRequest(
            request_type="cleaning",
            message="Need cleaning",
        )
        room_session = self._build_room_session()
        req_entity = self._build_request_entity()

        with (
            patch(
                "app.modules.housekeeping.service._cleanup_old_requests_for_restaurant",
                return_value=0,
            ),
            patch(
                "app.modules.housekeeping.service.repository.create_housekeeping_request",
                return_value=req_entity,
            ),
            patch(
                "app.modules.housekeeping.service._append_event",
                side_effect=RuntimeError("event write failed"),
            ),
        ):
            with self.assertRaises(RuntimeError):
                service.submit_request(db, room_session, payload)

        self.assertEqual(db.commit_calls, 0)
        self.assertEqual(db.rollback_calls, 1)


if __name__ == "__main__":
    unittest.main()
