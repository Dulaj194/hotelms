import sys
import unittest
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

import app.db.init_models  # noqa: F401
from app.db.base import Base  # noqa: E402
from app.modules.billing import service as billing_service  # noqa: E402
from app.modules.billing.model import BillHandoffStatus, BillStatus  # noqa: E402
from app.modules.billing.schemas import ReverseBillRequest, SettleSessionSplitRequest  # noqa: E402
from app.modules.orders.model import OrderHeader, OrderSource, OrderStatus  # noqa: E402
from app.modules.payments.model import Payment, PaymentStatus  # noqa: E402
from app.modules.restaurants.model import Restaurant  # noqa: E402
from app.modules.room_sessions.model import RoomSession  # noqa: E402
from app.modules.rooms.model import Room  # noqa: E402
from app.modules.table_sessions.model import TableSession, TableSessionStatus  # noqa: E402


class BillingSettlementLifecycleTests(unittest.TestCase):
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

    def tearDown(self) -> None:
        Base.metadata.drop_all(bind=self.engine)
        self.engine.dispose()

    def _create_restaurant(self, db: Session) -> Restaurant:
        suffix = uuid.uuid4().hex[:8]
        restaurant = Restaurant(
            name="Lifecycle Hotel",
            email=f"lifecycle-{suffix}@example.com",
            is_active=True,
        )
        db.add(restaurant)
        db.flush()
        return restaurant

    def _create_table_context(
        self,
        db: Session,
        *,
        restaurant_id: int,
        table_number: str,
        session_id: str,
        amount: float,
    ) -> TableSession:
        table_session = TableSession(
            session_id=session_id,
            restaurant_id=restaurant_id,
            table_number=table_number,
            customer_name="Guest",
            expires_at=datetime.now(UTC) + timedelta(hours=2),
            last_activity_at=datetime.now(UTC),
            is_active=True,
            session_status=TableSessionStatus.OPEN,
        )
        db.add(table_session)
        db.flush()

        order = OrderHeader(
            session_id=session_id,
            restaurant_id=restaurant_id,
            table_number=table_number,
            order_source=OrderSource.table,
            room_id=None,
            room_number=None,
            status=OrderStatus.completed,
            subtotal_amount=amount,
            tax_amount=0.0,
            discount_amount=0.0,
            total_amount=amount,
            notes="lifecycle test",
            customer_name="Guest",
            customer_phone=None,
            completed_at=datetime.now(UTC),
        )
        db.add(order)
        db.flush()

        payment = Payment(
            order_id=order.id,
            restaurant_id=restaurant_id,
            amount=amount,
            payment_method="pending",
            payment_status=PaymentStatus.pending,
        )
        db.add(payment)
        db.flush()

        return table_session

    def _create_room_context(
        self,
        db: Session,
        *,
        restaurant_id: int,
        room_number: str,
        session_id: str,
        amount: float,
    ) -> tuple[Room, RoomSession]:
        room = Room(
            restaurant_id=restaurant_id,
            room_number=room_number,
            room_name=f"Room {room_number}",
            is_active=True,
        )
        db.add(room)
        db.flush()

        room_session = RoomSession(
            session_id=session_id,
            restaurant_id=restaurant_id,
            room_id=room.id,
            room_number_snapshot=room_number,
            expires_at=datetime.now(UTC) + timedelta(hours=2),
            last_activity_at=datetime.now(UTC),
            is_active=True,
        )
        db.add(room_session)
        db.flush()

        order = OrderHeader(
            session_id=session_id,
            restaurant_id=restaurant_id,
            table_number=None,
            order_source=OrderSource.room,
            room_id=room.id,
            room_number=room_number,
            status=OrderStatus.completed,
            subtotal_amount=amount,
            tax_amount=0.0,
            discount_amount=0.0,
            total_amount=amount,
            notes="room lifecycle",
            customer_name="Guest",
            customer_phone=None,
            completed_at=datetime.now(UTC),
        )
        db.add(order)
        db.flush()

        payment = Payment(
            order_id=order.id,
            restaurant_id=restaurant_id,
            amount=amount,
            payment_method="pending",
            payment_status=PaymentStatus.pending,
        )
        db.add(payment)
        db.flush()
        return room, room_session

    def test_partial_split_then_finalize_with_idempotency_replay(self) -> None:
        db = self.SessionLocal()
        restaurant = self._create_restaurant(db)
        self._create_table_context(
            db,
            restaurant_id=restaurant.id,
            table_number="4",
            session_id="table-4-session",
            amount=100.0,
        )
        db.commit()

        first = billing_service.settle_session(
            db,
            session_id="4",
            restaurant_id=restaurant.id,
            payload=SettleSessionSplitRequest(
                payment_method="manual",
                tax_rule_mode="percentage",
                tax_rule_value=10,
                discount_rule_mode="fixed",
                discount_rule_value=5,
                payments=[
                    {
                        "payment_method": "cash",
                        "amount": 20,
                    },
                    {
                        "payment_method": "manual",
                        "amount": 20,
                        "transaction_reference": "ADV-20",
                    },
                ],
            ),
            idempotency_key="settle-key-1",
        )
        self.assertEqual(first.payment_status, BillStatus.partially_paid)
        self.assertTrue(first.is_partial)
        self.assertEqual(round(first.total_amount, 2), 105.0)
        self.assertEqual(round(first.paid_amount, 2), 40.0)
        self.assertEqual(round(first.remaining_amount, 2), 65.0)

        replay = billing_service.settle_session(
            db,
            session_id="4",
            restaurant_id=restaurant.id,
            payload=SettleSessionSplitRequest(
                payment_method="manual",
                tax_rule_mode="percentage",
                tax_rule_value=10,
                discount_rule_mode="fixed",
                discount_rule_value=5,
                payments=[
                    {
                        "payment_method": "cash",
                        "amount": 20,
                    },
                    {
                        "payment_method": "manual",
                        "amount": 20,
                        "transaction_reference": "ADV-20",
                    },
                ],
            ),
            idempotency_key="settle-key-1",
        )
        self.assertTrue(replay.idempotent_replay)
        self.assertEqual(replay.bill_id, first.bill_id)
        self.assertEqual(round(replay.paid_amount or 0, 2), 40.0)

        final = billing_service.settle_session(
            db,
            session_id="4",
            restaurant_id=restaurant.id,
            payload=SettleSessionSplitRequest(
                payment_method="card",
                paid_amount=65,
            ),
            idempotency_key="settle-key-2",
        )
        self.assertEqual(final.payment_status, BillStatus.paid)
        self.assertTrue(final.session_closed)
        self.assertEqual(round(final.remaining_amount or 0, 2), 0.0)

        paid_orders = db.query(OrderHeader).filter(OrderHeader.session_id == "table-4-session").all()
        self.assertEqual({order.status for order in paid_orders}, {OrderStatus.paid})

        payments = db.query(Payment).filter(Payment.restaurant_id == restaurant.id).all()
        self.assertEqual({payment.payment_status for payment in payments}, {PaymentStatus.paid})
        db.close()

    def test_reversal_reopens_context_and_marks_payments_reversed(self) -> None:
        db = self.SessionLocal()
        restaurant = self._create_restaurant(db)
        self._create_table_context(
            db,
            restaurant_id=restaurant.id,
            table_number="7",
            session_id="table-7-session",
            amount=80.0,
        )
        db.commit()

        settled = billing_service.settle_session(
            db,
            session_id="7",
            restaurant_id=restaurant.id,
            payload=SettleSessionSplitRequest(payment_method="cash"),
            idempotency_key="reverse-case-settle",
        )
        self.assertEqual(settled.payment_status, BillStatus.paid)

        reversed_bill = billing_service.reverse_bill(
            db,
            bill_id=settled.bill_id,
            restaurant_id=restaurant.id,
            payload=ReverseBillRequest(
                mode="reversal",
                reason="Chargeback dispute",
                reopen_session=True,
            ),
        )
        self.assertEqual(reversed_bill.payment_status, BillStatus.reversed)

        orders = db.query(OrderHeader).filter(OrderHeader.session_id == "table-7-session").all()
        self.assertEqual({order.status for order in orders}, {OrderStatus.completed})

        payments = db.query(Payment).filter(Payment.restaurant_id == restaurant.id).all()
        self.assertEqual({payment.payment_status for payment in payments}, {PaymentStatus.reversed})

        table_session = (
            db.query(TableSession)
            .filter(TableSession.session_id == "table-7-session", TableSession.restaurant_id == restaurant.id)
            .first()
        )
        assert table_session is not None
        self.assertTrue(table_session.is_active)
        self.assertEqual(table_session.session_status, TableSessionStatus.OPEN)
        db.close()

    def test_room_handoff_reject_reopen_and_reconciliation(self) -> None:
        db = self.SessionLocal()
        restaurant = self._create_restaurant(db)
        room, room_session = self._create_room_context(
            db,
            restaurant_id=restaurant.id,
            room_number="909",
            session_id="room-909-session",
            amount=210.0,
        )
        db.commit()

        settled = billing_service.settle_room_session(
            db,
            lookup=room.room_number,
            restaurant_id=restaurant.id,
            payload=SettleSessionSplitRequest(payment_method="manual", transaction_reference="CHK-909"),
            idempotency_key="room-flow-1",
        )
        self.assertEqual(settled.payment_status, BillStatus.paid)

        sent_cashier = billing_service.send_room_folio_to_cashier(
            db,
            bill_id=settled.bill_id,
            restaurant_id=restaurant.id,
        )
        self.assertEqual(sent_cashier.handoff_status, BillHandoffStatus.sent_to_cashier)

        rejected_cashier = billing_service.reject_cashier_folio(
            db,
            bill_id=settled.bill_id,
            restaurant_id=restaurant.id,
            note="Need correction",
        )
        self.assertEqual(rejected_cashier.handoff_status, BillHandoffStatus.none)

        billing_service.send_room_folio_to_cashier(
            db,
            bill_id=settled.bill_id,
            restaurant_id=restaurant.id,
        )
        billing_service.send_room_folio_to_accountant(
            db,
            bill_id=settled.bill_id,
            restaurant_id=restaurant.id,
        )
        rejected_accountant = billing_service.reject_accountant_folio(
            db,
            bill_id=settled.bill_id,
            restaurant_id=restaurant.id,
            note="Mismatch",
        )
        self.assertEqual(rejected_accountant.handoff_status, BillHandoffStatus.sent_to_cashier)

        billing_service.send_room_folio_to_accountant(
            db,
            bill_id=settled.bill_id,
            restaurant_id=restaurant.id,
        )
        completed = billing_service.complete_room_folio_handoff(
            db,
            bill_id=settled.bill_id,
            restaurant_id=restaurant.id,
        )
        self.assertEqual(completed.handoff_status, BillHandoffStatus.completed)

        billing_service.record_bill_print(
            db,
            bill_id=settled.bill_id,
            restaurant_id=restaurant.id,
        )
        reopened = billing_service.reopen_room_folio(
            db,
            bill_id=settled.bill_id,
            restaurant_id=restaurant.id,
        )
        self.assertEqual(reopened.handoff_status, BillHandoffStatus.none)

        reconciliation = billing_service.get_daily_reconciliation(
            db,
            restaurant_id=restaurant.id,
        )
        self.assertEqual(reconciliation.total_paid_bills, 1)
        self.assertEqual(reconciliation.total_paid_amount, 210.0)

        summary = billing_service.get_room_bill_summary(
            db,
            lookup=room_session.session_id,
            restaurant_id=restaurant.id,
        )
        self.assertEqual(summary.bill.payment_status, BillStatus.paid)
        db.close()


if __name__ == "__main__":
    unittest.main()
