import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.modules.payments import service  # noqa: E402
from app.modules.payments.model import BillingTransactionStatus  # noqa: E402


class PaymentsWebhookSourceOfTruthTests(unittest.TestCase):
    def _build_event(self, metadata: dict[str, str]) -> dict:
        return {
            "data": {
                "object": {
                    "id": "cs_test_123",
                    "metadata": metadata,
                    "payment_intent": "pi_test_123",
                    "customer": "cus_test_123",
                }
            }
        }

    def _build_transaction(self) -> SimpleNamespace:
        return SimpleNamespace(
            id=77,
            status=BillingTransactionStatus.pending,
            restaurant_id=44,
            package_id=9,
            paid_at=None,
        )

    def test_completed_webhook_uses_transaction_context_not_metadata(self) -> None:
        db = SimpleNamespace()
        transaction = self._build_transaction()
        event = self._build_event(
            {
                "billing_transaction_id": "77",
                "restaurant_id": "999",  # mismatched on purpose
                "package_id": "888",  # mismatched on purpose
                "promo_code": "save10",
            }
        )

        with (
            patch(
                "app.modules.payments.service.payment_repo.get_billing_transaction_by_checkout_session",
                return_value=transaction,
            ),
            patch("app.modules.payments.service.subscriptions_service.activate_paid_subscription") as activate,
            patch("app.modules.payments.service.payment_repo.mark_billing_transaction_paid") as mark_paid,
            patch("app.modules.payments.service.promo_codes_service.consume_promo_for_restaurant") as consume_promo,
        ):
            activate.return_value = SimpleNamespace(id=501)
            service._handle_checkout_completed(db, event)

        self.assertEqual(activate.call_args.kwargs["restaurant_id"], 44)
        self.assertEqual(activate.call_args.kwargs["package_id"], 9)
        self.assertEqual(consume_promo.call_args.kwargs["restaurant_id"], 44)
        self.assertEqual(consume_promo.call_args.kwargs["payload"].code, "SAVE10")
        self.assertEqual(mark_paid.call_args.kwargs["transaction"], transaction)
        self.assertEqual(mark_paid.call_args.kwargs["subscription_id"], 501)

    def test_completed_webhook_allows_missing_restaurant_and_package_metadata(self) -> None:
        db = SimpleNamespace()
        transaction = self._build_transaction()
        event = self._build_event(
            {
                "billing_transaction_id": "77",
                # restaurant_id/package_id intentionally absent
            }
        )

        with (
            patch(
                "app.modules.payments.service.payment_repo.get_billing_transaction_by_checkout_session",
                return_value=transaction,
            ),
            patch("app.modules.payments.service.subscriptions_service.activate_paid_subscription") as activate,
            patch("app.modules.payments.service.payment_repo.mark_billing_transaction_paid"),
            patch("app.modules.payments.service.payment_repo.mark_billing_transaction_failed") as mark_failed,
        ):
            activate.return_value = SimpleNamespace(id=600)
            service._handle_checkout_completed(db, event)

        self.assertEqual(activate.call_args.kwargs["restaurant_id"], 44)
        self.assertEqual(activate.call_args.kwargs["package_id"], 9)
        mark_failed.assert_not_called()

    def test_completed_webhook_fallback_lookup_uses_db_transaction_values(self) -> None:
        db = SimpleNamespace()
        transaction = self._build_transaction()
        event = self._build_event(
            {
                "billing_transaction_id": "77",
                "restaurant_id": "222",
                "package_id": "333",
            }
        )

        with (
            patch(
                "app.modules.payments.service.payment_repo.get_billing_transaction_by_checkout_session",
                return_value=None,
            ),
            patch(
                "app.modules.payments.service.payment_repo.get_billing_transaction_by_id",
                return_value=transaction,
            ) as get_by_id,
            patch("app.modules.payments.service.subscriptions_service.activate_paid_subscription") as activate,
            patch("app.modules.payments.service.payment_repo.mark_billing_transaction_paid"),
        ):
            activate.return_value = SimpleNamespace(id=700)
            service._handle_checkout_completed(db, event)

        get_by_id.assert_called_once_with(db, 77)
        self.assertEqual(activate.call_args.kwargs["restaurant_id"], 44)
        self.assertEqual(activate.call_args.kwargs["package_id"], 9)


if __name__ == "__main__":
    unittest.main()
