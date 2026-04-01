import sys
import unittest
from pathlib import Path

from fastapi import HTTPException, Response
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

import app.db.init_models  # noqa: F401
from app.core.security import hash_password  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.modules.auth import service as auth_service  # noqa: E402
from app.modules.restaurants import service as restaurants_service  # noqa: E402
from app.modules.restaurants.model import RegistrationStatus, Restaurant  # noqa: E402
from app.modules.restaurants.schemas import RestaurantRegistrationReviewRequest  # noqa: E402
from app.modules.subscriptions import repository as subscriptions_repository  # noqa: E402
from app.modules.users.model import User, UserRole  # noqa: E402
from app.modules.users.repository import get_user_by_email  # noqa: E402


class _FakeRedis:
    def get(self, _key: str):
        return None

    def pipeline(self):
        return self

    def incr(self, _key: str):
        return self

    def expire(self, _key: str, _seconds: int):
        return self

    def execute(self):
        return None

    def delete(self, _key: str):
        return 0

    def setex(self, _key: str, _seconds: int, _value: str):
        return True


class SuperAdminRegistrationReviewTests(unittest.TestCase):
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
        self.engine.dispose()

    def _create_pending_registration(self):
        db = self.SessionLocal()
        restaurant = Restaurant(
            name="Pending Hotel",
            email="owner@example.com",
            phone="0771234567",
            address="No 10, Main Street",
            opening_time="08:00",
            closing_time="22:00",
            is_active=False,
            registration_status=RegistrationStatus.PENDING,
        )
        db.add(restaurant)
        db.flush()

        owner = User(
            full_name="Pending Owner",
            email="owner@example.com",
            password_hash=hash_password("Password1"),
            role=UserRole.owner,
            restaurant_id=restaurant.id,
            is_active=False,
        )
        db.add(owner)
        reviewer = User(
            full_name="Platform Reviewer",
            email="super.admin@example.com",
            password_hash=hash_password("Password1"),
            role=UserRole.super_admin,
            restaurant_id=None,
            is_active=True,
        )
        db.add(reviewer)
        db.commit()
        return db, restaurant, owner, reviewer

    def test_login_returns_explicit_pending_message_for_unapproved_registration(self) -> None:
        db, restaurant, _owner, _reviewer = self._create_pending_registration()

        with self.assertRaises(HTTPException) as ctx:
            auth_service.login_restaurant_admin(
                db,
                _FakeRedis(),
                Response(),
                restaurant.email,
                "Password1",
                "127.0.0.1",
                "unit-test",
            )

        self.assertEqual(ctx.exception.status_code, 403)
        self.assertEqual(
            ctx.exception.detail,
            "Your registration is pending super admin approval.",
        )
        db.close()

    def test_user_lookup_uses_restaurant_membership_fk_without_mapper_ambiguity(self) -> None:
        db, _restaurant, owner, _reviewer = self._create_pending_registration()

        fetched_user = get_user_by_email(db, owner.email)

        self.assertIsNotNone(fetched_user)
        assert fetched_user is not None
        self.assertEqual(fetched_user.id, owner.id)
        self.assertEqual(fetched_user.restaurant_id, owner.restaurant_id)
        db.close()

    def test_approve_registration_activates_owner_and_trial(self) -> None:
        db, restaurant, owner, reviewer = self._create_pending_registration()

        response = restaurants_service.review_restaurant_registration(
            db,
            restaurant_id=restaurant.id,
            reviewer_user_id=reviewer.id,
            payload=RestaurantRegistrationReviewRequest(
                status="APPROVED",
                review_notes="Verified and approved.",
            ),
        )

        db.refresh(restaurant)
        db.refresh(owner)
        subscription = subscriptions_repository.get_latest_subscription_by_restaurant(
            db,
            restaurant.id,
        )

        self.assertEqual(response.message, "Registration approved. Trial subscription activated.")
        self.assertEqual(restaurant.registration_status, RegistrationStatus.APPROVED)
        self.assertTrue(restaurant.is_active)
        self.assertTrue(owner.is_active)
        self.assertIsNotNone(subscription)
        assert subscription is not None
        self.assertTrue(subscription.is_trial)
        db.close()

    def test_reject_registration_keeps_owner_inactive_and_skips_trial(self) -> None:
        db, restaurant, owner, reviewer = self._create_pending_registration()

        response = restaurants_service.review_restaurant_registration(
            db,
            restaurant_id=restaurant.id,
            reviewer_user_id=reviewer.id,
            payload=RestaurantRegistrationReviewRequest(
                status="REJECTED",
                review_notes="Incomplete onboarding information.",
            ),
        )

        db.refresh(restaurant)
        db.refresh(owner)
        subscription = subscriptions_repository.get_latest_subscription_by_restaurant(
            db,
            restaurant.id,
        )

        self.assertEqual(response.message, "Registration rejected.")
        self.assertEqual(restaurant.registration_status, RegistrationStatus.REJECTED)
        self.assertFalse(restaurant.is_active)
        self.assertFalse(owner.is_active)
        self.assertIsNone(subscription)
        db.close()


if __name__ == "__main__":
    unittest.main()
