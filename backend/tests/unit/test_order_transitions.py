import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.modules.orders.model import ALLOWED_TRANSITIONS, OrderStatus


class OrderTransitionTests(unittest.TestCase):
    def test_pending_transitions(self) -> None:
        self.assertIn(OrderStatus.confirmed, ALLOWED_TRANSITIONS[OrderStatus.pending])
        self.assertIn(OrderStatus.rejected, ALLOWED_TRANSITIONS[OrderStatus.pending])
        self.assertNotIn(OrderStatus.paid, ALLOWED_TRANSITIONS[OrderStatus.pending])

    def test_completed_transitions(self) -> None:
        self.assertEqual(ALLOWED_TRANSITIONS[OrderStatus.completed], {OrderStatus.served, OrderStatus.paid})

    def test_terminal_states_have_no_transitions(self) -> None:
        self.assertEqual(ALLOWED_TRANSITIONS[OrderStatus.paid], set())
        self.assertEqual(ALLOWED_TRANSITIONS[OrderStatus.rejected], set())


if __name__ == "__main__":
    unittest.main()
