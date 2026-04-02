import sys
import unittest
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

import app.db.init_models  # noqa: F401
from app.db.base import Base  # noqa: E402
from app.modules.billing import service as billing_service  # noqa: E402
from app.modules.billing.model import BillHandoffStatus, BillReviewStatus  # noqa: E402
from app.modules.billing.schemas import SettleSessionRequest  # noqa: E402
from app.modules.orders.model import OrderHeader, OrderSource, OrderStatus  # noqa: E402
from app.modules.packages.model import Package  # noqa: E402
from app.modules.payments.model import Payment, PaymentStatus  # noqa: E402
from app.modules.restaurants.model import Restaurant  # noqa: E402
from app.modules.rooms.model import Room  # noqa: E402
from app.modules.room_sessions.model import RoomSession  # noqa: E402


class BillingWorkflowDashboardServiceTests(unittest.TestCase):
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
            name="Workflow Hotel",
            email=f"workflow-{suffix}@example.com",
            is_active=True,
        )
        db.add(restaurant)
        db.flush()
        return restaurant

    def _create_package(self, db: Session) -> Package:
        package = Package(
            name="Pro",
            code=f"pro-{uuid.uuid4().hex[:8]}",
            description="Workflow package",
            price=Decimal("49.90"),
            billing_period_days=30,
            is_active=True,
        )
        db.add(package)
        db.flush()
        return package

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
            notes="workflow test",
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

    def test_workflow_transitions_update_dashboard_counts(self) -> None:
        seed_db = self.SessionLocal()
        self._create_package(seed_db)
        restaurant = self._create_restaurant(seed_db)
        room, room_session = self._create_room_context(
            seed_db,
            restaurant_id=restaurant.id,
            room_number="501",
            session_id="room-501-session",
            amount=230.0,
        )
        seed_db.commit()
        seed_db.close()

        db = self.SessionLocal()
        billing_service.settle_room_session(
            db,
            lookup=room.room_number,
            restaurant_id=restaurant.id,
            payload=SettleSessionRequest(
                payment_method="manual",
                transaction_reference="CHK-501",
                notes="checkout",
            ),
        )

        summary = billing_service.get_room_bill_summary(
            db,
            lookup=room_session.session_id,
            restaurant_id=restaurant.id,
        )
        self.assertIsNotNone(summary.bill)
        assert summary.bill is not None

        bill_id = summary.bill.id
        moved_to_cashier = billing_service.send_room_folio_to_cashier(
            db,
            bill_id=bill_id,
            restaurant_id=restaurant.id,
        )
        self.assertEqual(moved_to_cashier.handoff_status, BillHandoffStatus.sent_to_cashier)
        self.assertEqual(moved_to_cashier.cashier_status, BillReviewStatus.pending)

        cashier_accepted = billing_service.accept_cashier_folio(
            db,
            bill_id=bill_id,
            restaurant_id=restaurant.id,
        )
        self.assertEqual(cashier_accepted.cashier_status, BillReviewStatus.accepted)

        sent_to_accountant = billing_service.send_room_folio_to_accountant(
            db,
            bill_id=bill_id,
            restaurant_id=restaurant.id,
        )
        self.assertEqual(sent_to_accountant.handoff_status, BillHandoffStatus.sent_to_accountant)
        self.assertEqual(sent_to_accountant.accountant_status, BillReviewStatus.pending)

        accountant_accepted = billing_service.accept_accountant_folio(
            db,
            bill_id=bill_id,
            restaurant_id=restaurant.id,
        )
        self.assertEqual(accountant_accepted.handoff_status, BillHandoffStatus.completed)
        self.assertEqual(accountant_accepted.accountant_status, BillReviewStatus.accepted)

        queue_summary = billing_service.get_billing_queue_summary(
            db,
            restaurant_id=restaurant.id,
        )
        self.assertEqual(queue_summary.completed_count, 1)
        self.assertEqual(queue_summary.cashier_pending_count, 0)
        self.assertEqual(queue_summary.accountant_pending_count, 0)
        db.close()

    def test_print_and_reopen_actions_feed_audit_and_reconciliation(self) -> None:
        seed_db = self.SessionLocal()
        self._create_package(seed_db)
        restaurant = self._create_restaurant(seed_db)
        room, room_session = self._create_room_context(
            seed_db,
            restaurant_id=restaurant.id,
            room_number="601",
            session_id="room-601-session",
            amount=190.0,
        )
        seed_db.commit()
        seed_db.close()

        db = self.SessionLocal()
        billing_service.settle_room_session(
            db,
            lookup=room.room_number,
            restaurant_id=restaurant.id,
            payload=SettleSessionRequest(
                payment_method="cash",
                notes="same day checkout",
            ),
        )
        summary = billing_service.get_room_bill_summary(
            db,
            lookup=room_session.session_id,
            restaurant_id=restaurant.id,
        )
        assert summary.bill is not None
        bill_id = summary.bill.id

        billing_service.send_room_folio_to_cashier(
            db,
            bill_id=bill_id,
            restaurant_id=restaurant.id,
        )
        billing_service.send_room_folio_to_accountant(
            db,
            bill_id=bill_id,
            restaurant_id=restaurant.id,
        )
        billing_service.complete_room_folio_handoff(
            db,
            bill_id=bill_id,
            restaurant_id=restaurant.id,
        )
        billing_service.record_bill_print(
            db,
            bill_id=bill_id,
            restaurant_id=restaurant.id,
        )
        reopened = billing_service.reopen_room_folio(
            db,
            bill_id=bill_id,
            restaurant_id=restaurant.id,
        )
        self.assertEqual(reopened.handoff_status, BillHandoffStatus.none)
        self.assertEqual(reopened.reopened_count, 1)

        detail = billing_service.get_folio_detail(
            db,
            bill_id=bill_id,
            restaurant_id=restaurant.id,
        )
        action_types = [event.action_type for event in detail.events]
        self.assertIn("printed", action_types)
        self.assertIn("reopened", action_types)

        reconciliation = billing_service.get_daily_reconciliation(
            db,
            restaurant_id=restaurant.id,
        )
        self.assertEqual(reconciliation.total_paid_bills, 1)
        self.assertEqual(reconciliation.total_paid_amount, 190.0)
        self.assertEqual(reconciliation.printed_today_count, 1)
        self.assertEqual(reconciliation.reopened_today_count, 1)
        db.close()


if __name__ == "__main__":
    unittest.main()
