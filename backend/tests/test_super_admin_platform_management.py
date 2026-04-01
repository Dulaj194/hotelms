import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import Response
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

import app.db.init_models  # noqa: F401
from app.modules.auth import service as auth_service  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.modules.packages import service as packages_service  # noqa: E402
from app.modules.packages import repository as packages_repository  # noqa: E402
from app.modules.packages.schemas import PackageCreateRequest, PackageUpdateRequest  # noqa: E402
from app.modules.restaurants import service as restaurants_service  # noqa: E402
from app.modules.restaurants.model import RegistrationStatus, Restaurant  # noqa: E402
from app.modules.restaurants.schemas import (
    RestaurantIntegrationUpdateRequest,
    RestaurantRegistrationReviewRequest,
)  # noqa: E402
from app.modules.settings import service as settings_service  # noqa: E402
from app.modules.settings.schemas import SettingsRequestCreateRequest, SettingsRequestReviewRequest  # noqa: E402
from app.modules.subscriptions import service as subscriptions_service  # noqa: E402
from app.modules.subscriptions.schemas import SuperAdminSubscriptionUpdateRequest  # noqa: E402
from app.modules.users import service as users_service  # noqa: E402
from app.modules.users.model import User, UserRole  # noqa: E402
from app.modules.users.schemas import PlatformUserCreateRequest, StaffCreateRequest  # noqa: E402


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


class SuperAdminPlatformManagementTests(unittest.TestCase):
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
        self.db = self.SessionLocal()
        self.current_super_admin = User(
            full_name="Root Super Admin",
            email="root.super.admin@example.com",
            password_hash=hash_password("Password1"),
            role=UserRole.super_admin,
            restaurant_id=None,
            is_active=True,
        )
        self.db.add(self.current_super_admin)
        self.db.commit()
        self.db.refresh(self.current_super_admin)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _create_pending_restaurant(self) -> tuple[Restaurant, User]:
        restaurant = Restaurant(
            name="History Hotel",
            email="history.owner@example.com",
            phone="0775551212",
            address="No 1, History Street",
            is_active=False,
            registration_status=RegistrationStatus.PENDING,
        )
        self.db.add(restaurant)
        self.db.flush()

        owner = User(
            full_name="History Owner",
            email="history.owner@example.com",
            password_hash=hash_password("Password1"),
            role=UserRole.owner,
            restaurant_id=restaurant.id,
            is_active=True,
        )
        self.db.add(owner)
        self.db.commit()
        self.db.refresh(restaurant)
        self.db.refresh(owner)
        return restaurant, owner

    def _create_active_restaurant(self) -> Restaurant:
        restaurant = Restaurant(
            name="Access Hotel",
            email="access.owner@example.com",
            phone="0775556789",
            address="No 2, Access Street",
            is_active=True,
            registration_status=RegistrationStatus.APPROVED,
        )
        self.db.add(restaurant)
        self.db.commit()
        self.db.refresh(restaurant)
        return restaurant

    def _create_owner_for_restaurant(self, restaurant: Restaurant) -> User:
        owner = User(
            full_name=f"{restaurant.name} Owner",
            email=f"owner.{restaurant.id}@example.com",
            password_hash=hash_password("Password1"),
            role=UserRole.owner,
            restaurant_id=restaurant.id,
            is_active=True,
        )
        self.db.add(owner)
        self.db.commit()
        self.db.refresh(owner)
        return owner

    def test_package_crud_flow_supports_privileges(self) -> None:
        created = packages_service.create_package_for_super_admin(
            self.db,
            PackageCreateRequest(
                name="Enterprise",
                code="enterprise",
                description="Full platform access.",
                price="149.00",
                billing_period_days=30,
                is_active=True,
                privileges=["QR_MENU", "OFFERS"],
            ),
        )

        self.assertEqual(created.code, "enterprise")
        self.assertEqual(created.privileges, ["OFFERS", "QR_MENU"])

        updated = packages_service.update_package_for_super_admin(
            self.db,
            created.id,
            PackageUpdateRequest(
                price="159.00",
                privileges=["QR_MENU", "HOUSEKEEPING", "OFFERS"],
            ),
        )

        self.assertEqual(str(updated.price), "159.00")
        self.assertEqual(updated.privileges, ["HOUSEKEEPING", "OFFERS", "QR_MENU"])

        deleted = packages_service.delete_package_for_super_admin(self.db, created.id)
        self.assertEqual(deleted.package_id, created.id)

    def test_platform_user_lifecycle_respects_super_admin_guards(self) -> None:
        created = users_service.create_platform_user(
            self.db,
            PlatformUserCreateRequest(
                full_name="Operations Admin",
                email="ops.super.admin@example.com",
                username="ops.admin",
                phone="0711234567",
                password="Password1",
                is_active=True,
                must_change_password=True,
            ),
            self.current_super_admin,
        )

        self.assertEqual(created.role, "super_admin")
        self.assertTrue(created.must_change_password)

        disabled = users_service.disable_platform_user(
            self.db,
            created.id,
            self.current_super_admin,
        )
        self.assertFalse(disabled.is_active)

        deleted = users_service.delete_platform_user(
            self.db,
            created.id,
            self.current_super_admin,
        )
        self.assertEqual(deleted.message, "Platform user deleted successfully.")

    def test_super_admin_can_manage_cashier_and_accountant_roles(self) -> None:
        restaurant = self._create_active_restaurant()

        cashier = users_service.add_staff(
            self.db,
            None,
            StaffCreateRequest(
                full_name="Cashier User",
                email="cashier.user@example.com",
                password="Password1",
                role=UserRole.cashier,
                restaurant_id=restaurant.id,
            ),
            self.current_super_admin,
        )
        accountant = users_service.add_staff(
            self.db,
            None,
            StaffCreateRequest(
                full_name="Accountant User",
                email="accountant.user@example.com",
                password="Password1",
                role=UserRole.accountant,
                restaurant_id=restaurant.id,
            ),
            self.current_super_admin,
        )

        self.assertEqual(cashier.role, "cashier")
        self.assertEqual(cashier.assigned_area, "cashier")
        self.assertEqual(accountant.role, "accountant")
        self.assertEqual(accountant.assigned_area, "accounting")

    def test_staff_login_supports_cashier_and_accountant_roles(self) -> None:
        restaurant = self._create_active_restaurant()
        cashier = User(
            full_name="Shift Cashier",
            email="shift.cashier@example.com",
            password_hash=hash_password("Password1"),
            role=UserRole.cashier,
            assigned_area="cashier",
            restaurant_id=restaurant.id,
            is_active=True,
        )
        accountant = User(
            full_name="Shift Accountant",
            email="shift.accountant@example.com",
            password_hash=hash_password("Password1"),
            role=UserRole.accountant,
            assigned_area="accounting",
            restaurant_id=restaurant.id,
            is_active=True,
        )
        self.db.add_all([cashier, accountant])
        self.db.commit()

        cashier_token = auth_service.login_staff(
            self.db,
            _FakeRedis(),
            Response(),
            cashier.email,
            "Password1",
            "127.0.0.1",
            "unit-test",
        )
        accountant_token = auth_service.login_staff(
            self.db,
            _FakeRedis(),
            Response(),
            accountant.email,
            "Password1",
            "127.0.0.1",
            "unit-test",
        )

        self.assertTrue(bool(cashier_token.access_token))
        self.assertTrue(bool(accountant_token.access_token))

    def test_super_admin_access_summary_reflects_package_privileges(self) -> None:
        restaurant = self._create_active_restaurant()
        packages_service.ensure_default_packages(self.db)
        standard_package = packages_repository.get_package_by_code(self.db, "standard")
        self.assertIsNotNone(standard_package)

        subscriptions_service.activate_paid_subscription(
            self.db,
            restaurant_id=restaurant.id,
            package_id=standard_package.id,  # type: ignore[union-attr]
        )
        self.db.commit()

        access_summary = subscriptions_service.get_package_access_summary_for_super_admin(
            self.db,
            restaurant.id,
        )

        self.assertEqual(access_summary.package_code, "standard")
        self.assertEqual(
            [privilege.code for privilege in access_summary.privileges],
            ["HOUSEKEEPING", "QR_MENU"],
        )
        self.assertEqual(
            [module.key for module in access_summary.enabled_modules],
            ["orders", "qr", "kds", "reports", "billing", "housekeeping"],
        )

        updated = subscriptions_service.update_subscription_for_super_admin(
            self.db,
            restaurant.id,
            SuperAdminSubscriptionUpdateRequest(status="expired"),
        )
        self.assertEqual(updated.status, "expired")

        expired_access = subscriptions_service.get_package_access_summary_for_super_admin(
            self.db,
            restaurant.id,
        )
        self.assertEqual(expired_access.status, "expired")
        self.assertEqual(expired_access.privileges, [])
        self.assertEqual(expired_access.enabled_modules, [])

    def test_feature_toggles_update_effective_access_and_auth_snapshot(self) -> None:
        restaurant = self._create_active_restaurant()
        owner = self._create_owner_for_restaurant(restaurant)
        packages_service.ensure_default_packages(self.db)
        standard_package = packages_repository.get_package_by_code(self.db, "standard")
        self.assertIsNotNone(standard_package)

        subscriptions_service.activate_paid_subscription(
            self.db,
            restaurant_id=restaurant.id,
            package_id=standard_package.id,  # type: ignore[union-attr]
        )
        self.db.commit()

        settings_request = settings_service.create_settings_request(
            self.db,
            restaurant_id=restaurant.id,
            requested_by=owner.id,
            payload=SettingsRequestCreateRequest(
                requested_changes={"reports": False, "cashier": False},
                request_reason="Temporarily disable these modules.",
            ),
        )

        settings_service.review_settings_request(
            self.db,
            request_id=settings_request.request_id,
            reviewer_user_id=self.current_super_admin.id,
            payload=SettingsRequestReviewRequest(
                status="APPROVED",
                review_notes="Approved module toggle change.",
            ),
        )

        self.db.refresh(restaurant)
        self.assertFalse(restaurant.enable_reports)
        self.assertFalse(restaurant.enable_cashier)

        access_summary = subscriptions_service.get_package_access_summary(self.db, restaurant.id)
        module_access_map = {
            module.key: module.is_enabled for module in access_summary.module_access
        }
        feature_flag_map = {
            feature_flag.key: feature_flag.enabled for feature_flag in access_summary.feature_flags
        }

        self.assertEqual(access_summary.package_code, "standard")
        self.assertFalse(feature_flag_map["reports"])
        self.assertFalse(feature_flag_map["cashier"])
        self.assertFalse(module_access_map["reports"])
        self.assertTrue(module_access_map["billing"])

        me_snapshot = auth_service.get_user_me_snapshot(self.db, owner)
        self.assertEqual(me_snapshot.package_code, "standard")
        self.assertEqual(me_snapshot.subscription_status, "active")
        self.assertIn("QR_MENU", me_snapshot.privileges)
        self.assertFalse(me_snapshot.feature_flags.reports)
        self.assertFalse(me_snapshot.feature_flags.cashier)
        self.assertFalse(me_snapshot.module_access.reports)
        self.assertTrue(me_snapshot.module_access.billing)

    def test_restaurant_api_key_and_webhook_management_flow(self) -> None:
        restaurant = self._create_active_restaurant()

        provisioned = restaurants_service.provision_restaurant_api_key(
            self.db,
            restaurant_id=restaurant.id,
            current_user_id=self.current_super_admin.id,
            rotate=False,
        )

        self.assertTrue(provisioned.summary.has_key)
        self.assertTrue(provisioned.summary.is_active)
        self.assertTrue(provisioned.api_key.startswith("hmsrk_"))

        looked_up = restaurants_service.find_restaurant_by_api_key(
            self.db,
            provisioned.api_key,
        )
        self.assertIsNotNone(looked_up)
        assert looked_up is not None
        self.assertEqual(looked_up.id, restaurant.id)

        integration = restaurants_service.update_restaurant_integration_settings(
            self.db,
            restaurant_id=restaurant.id,
            payload=RestaurantIntegrationUpdateRequest(
                public_ordering_enabled=True,
                webhook_url="https://example.com/webhooks/orders",
            ),
            current_user_id=self.current_super_admin.id,
        )
        self.assertTrue(integration.settings.public_ordering_enabled)
        self.assertEqual(
            integration.settings.webhook_status,
            "degraded",
        )

        with patch(
            "app.modules.restaurants.service._probe_webhook_url",
            return_value=(True, None),
        ):
            refreshed = restaurants_service.refresh_restaurant_webhook_health(
                self.db,
                restaurant_id=restaurant.id,
                current_user_id=self.current_super_admin.id,
            )

        self.assertEqual(refreshed.settings.webhook_status, "healthy")

        revoked = restaurants_service.revoke_restaurant_api_key(
            self.db,
            restaurant_id=restaurant.id,
            current_user_id=self.current_super_admin.id,
        )
        self.assertFalse(revoked.has_key)
        self.assertIsNone(
            restaurants_service.find_restaurant_by_api_key(
                self.db,
                provisioned.api_key,
            )
        )

    def test_review_history_lists_reviewed_records(self) -> None:
        restaurant, owner = self._create_pending_restaurant()

        restaurants_service.review_restaurant_registration(
            self.db,
            restaurant_id=restaurant.id,
            reviewer_user_id=self.current_super_admin.id,
            payload=RestaurantRegistrationReviewRequest(
                status="APPROVED",
                review_notes="Verified registration details.",
            ),
        )

        registration_history = restaurants_service.list_restaurant_registration_history(
            self.db,
            registration_status=RegistrationStatus.APPROVED,
            limit=10,
        )

        self.assertEqual(registration_history.total, 1)
        self.assertEqual(registration_history.items[0].restaurant_id, restaurant.id)

        settings_request = settings_service.create_settings_request(
            self.db,
            restaurant_id=restaurant.id,
            requested_by=owner.id,
            payload=SettingsRequestCreateRequest(
                requested_changes={"phone": "0112233445"},
                request_reason="Switch reception line.",
            ),
        )

        settings_service.review_settings_request(
            self.db,
            request_id=settings_request.request_id,
            reviewer_user_id=self.current_super_admin.id,
            payload=SettingsRequestReviewRequest(
                status="APPROVED",
                review_notes="Phone number updated after verification.",
            ),
        )

        settings_history = settings_service.list_reviewed_settings_requests(
            self.db,
            restaurant_id=restaurant.id,
            status=None,
            limit=10,
        )

        self.assertEqual(settings_history.total, 1)
        self.assertEqual(settings_history.items[0].request_id, settings_request.request_id)


if __name__ == "__main__":
    unittest.main()
