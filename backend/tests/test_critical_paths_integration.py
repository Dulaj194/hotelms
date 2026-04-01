import sys
import unittest
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

import app.db.init_models  # noqa: F401
from app.api.router import router as api_router  # noqa: E402
from app.core import dependencies  # noqa: E402
from app.core.security import create_guest_session_token  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.modules.billing import repository as billing_repo  # noqa: E402
from app.modules.billing import service as billing_service  # noqa: E402
from app.modules.billing.model import BillContextType, BillHandoffStatus  # noqa: E402
from app.modules.billing.schemas import SettleSessionRequest  # noqa: E402
from app.modules.orders.model import OrderHeader, OrderSource, OrderStatus  # noqa: E402
from app.modules.packages.model import Package  # noqa: E402
from app.modules.payments import repository as payment_repo  # noqa: E402
from app.modules.payments import service as payments_service  # noqa: E402
from app.modules.payments.model import (  # noqa: E402
    BillingTransaction,
    BillingTransactionStatus,
    Payment,
    PaymentStatus,
    ProcessedWebhookEvent,
)
from app.modules.restaurants.model import Restaurant  # noqa: E402
from app.modules.rooms.model import Room  # noqa: E402
from app.modules.room_sessions.model import RoomSession  # noqa: E402
from app.modules.table_sessions.model import TableSession  # noqa: E402


class _InMemoryRedis:
    def __init__(self) -> None:
        self._store: dict[str, dict[str, str]] = {}

    def hgetall(self, key: str) -> dict[str, str]:
        return dict(self._store.get(key, {}))

    def hset(self, key: str, field: str, value: str) -> None:
        bucket = self._store.setdefault(key, {})
        bucket[field] = value

    def expire(self, key: str, _seconds: int) -> bool:
        return key in self._store

    def hdel(self, key: str, field: str) -> int:
        bucket = self._store.get(key)
        if not bucket or field not in bucket:
            return 0
        del bucket[field]
        if not bucket:
            del self._store[key]
        return 1

    def hlen(self, key: str) -> int:
        return len(self._store.get(key, {}))

    def delete(self, key: str) -> int:
        existed = key in self._store
        self._store.pop(key, None)
        return 1 if existed else 0


class CriticalPathsIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine,
            expire_on_commit=False,
        )
        Base.metadata.create_all(bind=self.engine)

        self.redis = _InMemoryRedis()

        app = FastAPI()
        app.include_router(api_router)

        def override_get_db():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[dependencies.get_db] = override_get_db
        app.dependency_overrides[dependencies.get_redis] = lambda: self.redis

        self.app = app
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        self.app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=self.engine)
        self.engine.dispose()

    def _create_restaurant(self, db: Session, *, name: str = "Test Restaurant") -> Restaurant:
        suffix = uuid.uuid4().hex[:8]
        restaurant = Restaurant(
            name=name,
            email=f"owner-{suffix}@example.com",
            is_active=True,
        )
        db.add(restaurant)
        db.flush()
        return restaurant

    def _create_active_table_session(
        self,
        db: Session,
        *,
        restaurant_id: int,
        session_id: str,
        table_number: str,
    ) -> TableSession:
        now = datetime.now(UTC)
        session = TableSession(
            session_id=session_id,
            restaurant_id=restaurant_id,
            table_number=table_number,
            expires_at=now + timedelta(hours=2),
            last_activity_at=now,
            is_active=True,
        )
        db.add(session)
        db.flush()
        return session

    def _create_package(self, db: Session) -> Package:
        package = Package(
            name="Pro",
            code=f"pro-{uuid.uuid4().hex[:8]}",
            description="Integration test plan",
            price=Decimal("49.90"),
            billing_period_days=30,
            is_active=True,
        )
        db.add(package)
        db.flush()
        return package

    def _create_completed_order_with_pending_payment(
        self,
        db: Session,
        *,
        session_id: str,
        restaurant_id: int,
        table_number: str,
        amount: float,
    ) -> tuple[OrderHeader, Payment]:
        completed_order = OrderHeader(
            session_id=session_id,
            restaurant_id=restaurant_id,
            table_number=table_number,
            order_source=OrderSource.table,
            status=OrderStatus.completed,
            subtotal_amount=amount,
            tax_amount=0.0,
            discount_amount=0.0,
            total_amount=amount,
            notes=None,
            customer_name=None,
            customer_phone=None,
            completed_at=datetime.now(UTC),
        )
        db.add(completed_order)
        db.flush()

        payment = Payment(
            order_id=completed_order.id,
            restaurant_id=restaurant_id,
            amount=amount,
            payment_method="pending",
            payment_status=PaymentStatus.pending,
        )
        db.add(payment)
        db.flush()
        return completed_order, payment

    def _create_room(
        self,
        db: Session,
        *,
        restaurant_id: int,
        room_number: str,
    ) -> Room:
        room = Room(
            restaurant_id=restaurant_id,
            room_number=room_number,
            room_name=f"Room {room_number}",
            is_active=True,
        )
        db.add(room)
        db.flush()
        return room

    def _create_active_room_session(
        self,
        db: Session,
        *,
        restaurant_id: int,
        room_id: int,
        room_number: str,
        session_id: str,
    ) -> RoomSession:
        now = datetime.now(UTC)
        session = RoomSession(
            session_id=session_id,
            restaurant_id=restaurant_id,
            room_id=room_id,
            room_number_snapshot=room_number,
            expires_at=now + timedelta(hours=2),
            last_activity_at=now,
            is_active=True,
        )
        db.add(session)
        db.flush()
        return session

    def _create_completed_room_order_with_pending_payment(
        self,
        db: Session,
        *,
        session_id: str,
        restaurant_id: int,
        room_id: int,
        room_number: str,
        amount: float,
    ) -> tuple[OrderHeader, Payment]:
        completed_order = OrderHeader(
            session_id=session_id,
            restaurant_id=restaurant_id,
            table_number=None,
            order_source=OrderSource.room,
            room_id=room_id,
            room_number=room_number,
            status=OrderStatus.completed,
            subtotal_amount=amount,
            tax_amount=0.0,
            discount_amount=0.0,
            total_amount=amount,
            notes="room folio test",
            customer_name="Room Guest",
            customer_phone=None,
            completed_at=datetime.now(UTC),
        )
        db.add(completed_order)
        db.flush()

        payment = Payment(
            order_id=completed_order.id,
            restaurant_id=restaurant_id,
            amount=amount,
            payment_method="pending",
            payment_status=PaymentStatus.pending,
        )
        db.add(payment)
        db.flush()
        return completed_order, payment

    def test_cart_allows_valid_guest_session_token(self) -> None:
        db = self.SessionLocal()
        restaurant = self._create_restaurant(db, name="Cart Happy Path")
        persisted_session = self._create_active_table_session(
            db,
            restaurant_id=restaurant.id,
            session_id="sess-valid-001",
            table_number="A1",
        )
        db.commit()
        db.close()

        token = create_guest_session_token(
            session_id=persisted_session.session_id,
            restaurant_id=restaurant.id,
            table_number="A1",
            expire_minutes=30,
        )

        response = self.client.get(
            "/api/v1/cart",
            headers={"X-Guest-Session": token},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["session_id"], "sess-valid-001")
        self.assertEqual(payload["restaurant_id"], restaurant.id)
        self.assertEqual(payload["table_number"], "A1")
        self.assertEqual(payload["item_count"], 0)

    def test_cart_rejects_guest_token_when_restaurant_claim_mismatches_db_session(self) -> None:
        db = self.SessionLocal()
        restaurant = self._create_restaurant(db, name="Cart Security")
        persisted_session = self._create_active_table_session(
            db,
            restaurant_id=restaurant.id,
            session_id="sess-gap-001",
            table_number="B7",
        )
        db.commit()
        db.close()

        forged_context_token = create_guest_session_token(
            session_id=persisted_session.session_id,
            restaurant_id=restaurant.id + 999,
            table_number="B7",
            expire_minutes=30,
        )

        response = self.client.get(
            "/api/v1/cart",
            headers={"X-Guest-Session": forged_context_token},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Invalid or expired guest session.")

    def test_webhook_marks_transaction_failed_when_required_metadata_is_missing(self) -> None:
        seed_db = self.SessionLocal()
        restaurant = self._create_restaurant(seed_db, name="Webhook Security")
        package = self._create_package(seed_db)
        transaction = payment_repo.create_billing_transaction(
            seed_db,
            restaurant_id=restaurant.id,
            package_id=package.id,
            amount=49.90,
            currency="usd",
        )
        payment_repo.set_checkout_session_id(
            seed_db,
            transaction=transaction,
            session_id="cs_missing_metadata",
        )
        seed_db.commit()
        transaction_id = transaction.id
        seed_db.close()

        event = {
            "id": "evt_missing_metadata",
            "type": "checkout.session.completed",
            "data": {"object": {"id": "cs_missing_metadata", "metadata": {}}},
        }
        fake_stripe = SimpleNamespace(
            api_key="",
            Webhook=SimpleNamespace(
                construct_event=lambda payload, sig_header, secret: event,
            ),
        )

        db = self.SessionLocal()
        with (
            patch.object(payments_service, "_get_stripe_module", return_value=fake_stripe),
            patch.object(payments_service.settings, "stripe_secret_key", "sk_test"),
            patch.object(payments_service.settings, "stripe_webhook_secret", "whsec_test"),
        ):
            payments_service.process_webhook(
                db,
                payload_bytes=b"{}",
                stripe_signature="sig_test",
            )
        db.close()

        verify_db = self.SessionLocal()
        stored_tx = (
            verify_db.query(BillingTransaction)
            .filter(BillingTransaction.id == transaction_id)
            .first()
        )
        self.assertIsNotNone(stored_tx)
        assert stored_tx is not None
        self.assertEqual(stored_tx.status, BillingTransactionStatus.failed)
        self.assertEqual(
            stored_tx.failure_reason,
            "Missing metadata in Stripe checkout session.",
        )

        processed_event = (
            verify_db.query(ProcessedWebhookEvent)
            .filter(ProcessedWebhookEvent.event_id == "evt_missing_metadata")
            .first()
        )
        self.assertIsNotNone(processed_event)
        verify_db.close()

    def test_settlement_rolls_back_all_changes_when_mid_transaction_step_fails(self) -> None:
        seed_db = self.SessionLocal()
        restaurant = self._create_restaurant(seed_db, name="Rollback Safety")
        table_session = self._create_active_table_session(
            seed_db,
            restaurant_id=restaurant.id,
            session_id="sess-rollback-001",
            table_number="C3",
        )
        order, payment = self._create_completed_order_with_pending_payment(
            seed_db,
            session_id=table_session.session_id,
            restaurant_id=restaurant.id,
            table_number="C3",
            amount=120.0,
        )
        seed_db.commit()
        restaurant_id = restaurant.id
        order_id = order.id
        session_id = table_session.session_id
        seed_db.close()

        db = self.SessionLocal()
        payload = SettleSessionRequest(
            payment_method="cash",
            transaction_reference="TXN-ROLLBACK-1",
            notes="rollback integration test",
        )
        with patch(
            "app.modules.billing.service.payment_repo.update_payments_for_settlement",
            side_effect=RuntimeError("forced settlement failure"),
        ):
            with self.assertRaises(HTTPException) as ctx:
                billing_service.settle_session(
                    db,
                    session_id=session_id,
                    restaurant_id=restaurant_id,
                    payload=payload,
                )
        db.close()

        self.assertEqual(ctx.exception.status_code, 500)
        self.assertEqual(ctx.exception.detail, "Settlement failed. Please try again.")

        verify_db = self.SessionLocal()
        self.assertIsNone(
            billing_repo.get_bill_by_session(
                verify_db,
                session_id=session_id,
                restaurant_id=restaurant_id,
            )
        )

        stored_order = (
            verify_db.query(OrderHeader)
            .filter(OrderHeader.id == order_id, OrderHeader.restaurant_id == restaurant_id)
            .first()
        )
        self.assertIsNotNone(stored_order)
        assert stored_order is not None
        self.assertEqual(stored_order.status, OrderStatus.completed)
        self.assertIsNone(stored_order.paid_at)

        stored_payment = (
            verify_db.query(Payment)
            .filter(Payment.order_id == order_id, Payment.restaurant_id == restaurant_id)
            .first()
        )
        self.assertIsNotNone(stored_payment)
        assert stored_payment is not None
        self.assertEqual(stored_payment.payment_status, PaymentStatus.pending)
        self.assertEqual(stored_payment.payment_method, "pending")
        self.assertIsNone(stored_payment.paid_at)

        stored_session = (
            verify_db.query(TableSession)
            .filter(
                TableSession.session_id == session_id,
                TableSession.restaurant_id == restaurant_id,
            )
            .first()
        )
        self.assertIsNotNone(stored_session)
        assert stored_session is not None
        self.assertTrue(stored_session.is_active)
        verify_db.close()

    def test_room_folio_settlement_supports_handoff_workflow(self) -> None:
        seed_db = self.SessionLocal()
        restaurant = self._create_restaurant(seed_db, name="Room Folio Hotel")
        room = self._create_room(
            seed_db,
            restaurant_id=restaurant.id,
            room_number="401",
        )
        room_session = self._create_active_room_session(
            seed_db,
            restaurant_id=restaurant.id,
            room_id=room.id,
            room_number=room.room_number,
            session_id="room-folio-401",
        )
        order, _payment = self._create_completed_room_order_with_pending_payment(
            seed_db,
            session_id=room_session.session_id,
            restaurant_id=restaurant.id,
            room_id=room.id,
            room_number=room.room_number,
            amount=245.0,
        )
        seed_db.commit()
        restaurant_id = restaurant.id
        session_id = room_session.session_id
        room_number = room.room_number
        order_id = order.id
        seed_db.close()

        db = self.SessionLocal()
        settlement = billing_service.settle_room_session(
            db,
            lookup=room_number,
            restaurant_id=restaurant_id,
            payload=SettleSessionRequest(
                payment_method="manual",
                transaction_reference="ROOM-401-CHECKOUT",
                notes="checkout folio settlement",
            ),
        )
        self.assertEqual(settlement.context_type, BillContextType.room)
        self.assertEqual(settlement.room_number, "401")
        self.assertTrue(settlement.session_closed)
        db.close()

        verify_db = self.SessionLocal()
        summary = billing_service.get_room_bill_summary(
            verify_db,
            lookup=session_id,
            restaurant_id=restaurant_id,
        )
        self.assertTrue(summary.is_settled)
        self.assertEqual(summary.context_type, BillContextType.room)
        self.assertIsNotNone(summary.bill)
        assert summary.bill is not None
        self.assertEqual(summary.bill.room_number, "401")
        self.assertEqual(summary.bill.handoff_status, BillHandoffStatus.none)

        moved_to_cashier = billing_service.send_room_folio_to_cashier(
            verify_db,
            bill_id=summary.bill.id,
            restaurant_id=restaurant_id,
        )
        self.assertEqual(
            moved_to_cashier.handoff_status,
            BillHandoffStatus.sent_to_cashier,
        )

        moved_to_accountant = billing_service.send_room_folio_to_accountant(
            verify_db,
            bill_id=summary.bill.id,
            restaurant_id=restaurant_id,
        )
        self.assertEqual(
            moved_to_accountant.handoff_status,
            BillHandoffStatus.sent_to_accountant,
        )

        completed = billing_service.complete_room_folio_handoff(
            verify_db,
            bill_id=summary.bill.id,
            restaurant_id=restaurant_id,
        )
        self.assertEqual(completed.handoff_status, BillHandoffStatus.completed)

        stored_order = (
            verify_db.query(OrderHeader)
            .filter(OrderHeader.id == order_id, OrderHeader.restaurant_id == restaurant_id)
            .first()
        )
        self.assertIsNotNone(stored_order)
        assert stored_order is not None
        self.assertEqual(stored_order.status, OrderStatus.paid)
        self.assertIsNotNone(stored_order.paid_at)

        stored_payment = (
            verify_db.query(Payment)
            .filter(Payment.order_id == order_id, Payment.restaurant_id == restaurant_id)
            .first()
        )
        self.assertIsNotNone(stored_payment)
        assert stored_payment is not None
        self.assertEqual(stored_payment.payment_status, PaymentStatus.paid)
        self.assertEqual(stored_payment.payment_method, "manual")

        stored_room_session = (
            verify_db.query(RoomSession)
            .filter(
                RoomSession.session_id == session_id,
                RoomSession.restaurant_id == restaurant_id,
            )
            .first()
        )
        self.assertIsNotNone(stored_room_session)
        assert stored_room_session is not None
        self.assertFalse(stored_room_session.is_active)
        verify_db.close()


if __name__ == "__main__":
    unittest.main()
