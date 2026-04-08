import sys
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException, Response
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

import app.db.init_models  # noqa: F401
from app.modules.auth import service as auth_service  # noqa: E402
from app.modules.audit_logs import service as audit_logs_service  # noqa: E402
from app.modules.audit_logs.schemas import SuperAdminNotificationUpdateRequest  # noqa: E402
from app.core.security import hash_password, verify_password  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.modules.packages import service as packages_service  # noqa: E402
from app.modules.packages import repository as packages_repository  # noqa: E402
from app.modules.packages.schemas import PackageCreateRequest, PackageUpdateRequest  # noqa: E402
from app.modules.restaurants import integration_service  # noqa: E402
from app.modules.restaurants import service as restaurants_service  # noqa: E402
from app.modules.restaurants.model import RegistrationStatus, Restaurant  # noqa: E402
from app.modules.restaurants.schemas import (
    RestaurantIntegrationUpdateRequest,
    RestaurantRegistrationReviewRequest,
    RestaurantStaffPasswordResetRequest,
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
                super_admin_scopes=["ops_viewer", "tenant_admin"],
            ),
            self.current_super_admin,
        )

        self.assertEqual(created.role, "super_admin")
        self.assertTrue(created.must_change_password)
        self.assertEqual(created.super_admin_scopes, ["ops_viewer", "tenant_admin"])

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

    def test_super_admin_can_reset_owner_password_with_generated_temporary_password(self) -> None:
        restaurant = self._create_active_restaurant()
        owner = self._create_owner_for_restaurant(restaurant)

        with patch(
            "app.modules.restaurants.service.send_temporary_password_reset_email",
            return_value=True,
        ) as mocked_sender:
            response = restaurants_service.reset_restaurant_staff_password(
                self.db,
                restaurant_id=restaurant.id,
                user_id=owner.id,
                payload=RestaurantStaffPasswordResetRequest(),
                current_user_id=self.current_super_admin.id,
            )

        self.db.refresh(owner)
        self.assertEqual(response.user_id, owner.id)
        self.assertEqual(response.role, "owner")
        self.assertTrue(response.must_change_password)
        self.assertTrue(response.email_sent)
        self.assertIsNone(response.reveal_token)
        self.assertIsNone(response.reveal_expires_at)
        self.assertTrue(owner.must_change_password)
        generated_password = mocked_sender.call_args.kwargs["temporary_password"]
        self.assertIn("sent to the user's email", response.message)
        self.assertTrue(verify_password(generated_password, owner.password_hash))

    def test_super_admin_can_reset_admin_password_with_custom_temporary_password(self) -> None:
        restaurant = self._create_active_restaurant()
        admin = users_service.add_staff(
            self.db,
            None,
            StaffCreateRequest(
                full_name="Resettable Admin",
                email="resettable.admin@example.com",
                password="Password1",
                role=UserRole.admin,
                restaurant_id=restaurant.id,
            ),
            self.current_super_admin,
        )

        with patch(
            "app.modules.restaurants.service.send_temporary_password_reset_email",
            return_value=True,
        ) as mocked_sender:
            response = restaurants_service.reset_restaurant_staff_password(
                self.db,
                restaurant_id=restaurant.id,
                user_id=admin.id,
                payload=RestaurantStaffPasswordResetRequest(temporary_password="TempAdmin123"),
                current_user_id=self.current_super_admin.id,
            )

        updated_admin = self.db.query(User).filter(User.id == admin.id).first()
        self.assertIsNotNone(updated_admin)
        assert updated_admin is not None
        self.assertTrue(response.email_sent)
        self.assertIsNone(response.reveal_token)
        self.assertEqual(mocked_sender.call_args.kwargs["temporary_password"], "TempAdmin123")
        self.assertTrue(updated_admin.must_change_password)
        self.assertTrue(verify_password("TempAdmin123", updated_admin.password_hash))

    def test_super_admin_reset_password_marks_email_sent_when_notification_succeeds(self) -> None:
        restaurant = self._create_active_restaurant()
        owner = self._create_owner_for_restaurant(restaurant)

        with patch(
            "app.modules.restaurants.service.send_temporary_password_reset_email",
            return_value=True,
        ) as mocked_sender:
            response = restaurants_service.reset_restaurant_staff_password(
                self.db,
                restaurant_id=restaurant.id,
                user_id=owner.id,
                payload=RestaurantStaffPasswordResetRequest(),
                current_user_id=self.current_super_admin.id,
            )

        self.db.refresh(owner)
        self.assertTrue(response.email_sent)
        self.assertIn("sent to the user's email", response.message)
        sent_password = mocked_sender.call_args.kwargs["temporary_password"]
        mocked_sender.assert_called_once_with(
            recipient_email=owner.email,
            recipient_name=owner.full_name,
            restaurant_name=restaurant.name,
            temporary_password=sent_password,
        )
        self.assertTrue(verify_password(sent_password, owner.password_hash))

    def test_super_admin_reset_password_issues_secure_reveal_token_when_email_fails(self) -> None:
        restaurant = self._create_active_restaurant()
        owner = self._create_owner_for_restaurant(restaurant)

        with patch(
            "app.modules.restaurants.service.send_temporary_password_reset_email",
            return_value=False,
        ):
            response = restaurants_service.reset_restaurant_staff_password(
                self.db,
                restaurant_id=restaurant.id,
                user_id=owner.id,
                payload=RestaurantStaffPasswordResetRequest(temporary_password="TempOwner123"),
                current_user_id=self.current_super_admin.id,
            )

        self.db.refresh(owner)
        self.assertFalse(response.email_sent)
        self.assertIsNotNone(response.reveal_token)
        self.assertIsNotNone(response.reveal_expires_at)
        self.assertIn("secure one-time reveal flow", response.message)
        self.assertTrue(verify_password("TempOwner123", owner.password_hash))

        assert response.reveal_token is not None
        reveal = restaurants_service.reveal_restaurant_staff_temporary_password(
            self.db,
            restaurant_id=restaurant.id,
            user_id=owner.id,
            reveal_token=response.reveal_token,
            current_user_id=self.current_super_admin.id,
        )
        self.assertEqual(reveal.user_id, owner.id)
        self.assertEqual(reveal.temporary_password, "TempOwner123")

        with self.assertRaises(HTTPException) as ctx:
            restaurants_service.reveal_restaurant_staff_temporary_password(
                self.db,
                restaurant_id=restaurant.id,
                user_id=owner.id,
                reveal_token=response.reveal_token,
                current_user_id=self.current_super_admin.id,
            )

        self.assertEqual(ctx.exception.status_code, 404)
        self.assertEqual(
            ctx.exception.detail,
            "Temporary password reveal token is invalid or expired.",
        )

    def test_super_admin_reset_password_rejects_non_owner_admin_roles(self) -> None:
        restaurant = self._create_active_restaurant()
        steward = users_service.add_staff(
            self.db,
            None,
            StaffCreateRequest(
                full_name="Steward User",
                email="steward.reset.blocked@example.com",
                password="Password1",
                role=UserRole.steward,
                restaurant_id=restaurant.id,
            ),
            self.current_super_admin,
        )

        with self.assertRaises(HTTPException) as ctx:
            restaurants_service.reset_restaurant_staff_password(
                self.db,
                restaurant_id=restaurant.id,
                user_id=steward.id,
                payload=RestaurantStaffPasswordResetRequest(),
                current_user_id=self.current_super_admin.id,
            )

        self.assertEqual(ctx.exception.status_code, 422)
        self.assertEqual(
            ctx.exception.detail,
            "Temporary password reset is allowed only for owner/admin accounts.",
        )

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
            ["orders", "qr", "kds", "steward_ops", "reports", "billing", "housekeeping"],
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
                requested_changes={"reports": False, "cashier": False, "steward": False},
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
        self.assertFalse(restaurant.enable_steward)

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
        self.assertFalse(feature_flag_map["steward"])
        self.assertFalse(module_access_map["reports"])
        self.assertFalse(module_access_map["steward_ops"])
        self.assertTrue(module_access_map["billing"])

        me_snapshot = auth_service.get_user_me_snapshot(self.db, owner)
        self.assertEqual(me_snapshot.package_code, "standard")
        self.assertEqual(me_snapshot.subscription_status, "active")
        self.assertIn("QR_MENU", me_snapshot.privileges)
        self.assertFalse(me_snapshot.feature_flags.reports)
        self.assertFalse(me_snapshot.feature_flags.cashier)
        self.assertFalse(me_snapshot.feature_flags.steward)
        self.assertFalse(me_snapshot.module_access.reports)
        self.assertFalse(me_snapshot.module_access.steward_ops)
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

    def test_webhook_delivery_ops_track_failures_retries_and_secret_summary(self) -> None:
        restaurant = self._create_active_restaurant()

        integration = restaurants_service.update_restaurant_integration_settings(
            self.db,
            restaurant_id=restaurant.id,
            payload=RestaurantIntegrationUpdateRequest(
                public_ordering_enabled=True,
                webhook_url="https://example.com/webhooks/orders",
                webhook_secret_header_name="X-HotelMS-Webhook-Secret",
            ),
            current_user_id=self.current_super_admin.id,
        )
        self.assertEqual(
            integration.settings.webhook_secret_header_name,
            "X-HotelMS-Webhook-Secret",
        )

        provisioned_secret = integration_service.provision_restaurant_webhook_secret(
            self.db,
            restaurant_id=restaurant.id,
            current_user_id=self.current_super_admin.id,
            rotate=False,
        )
        self.assertTrue(provisioned_secret.summary.has_secret)
        self.assertEqual(
            provisioned_secret.summary.header_name,
            "X-HotelMS-Webhook-Secret",
        )
        self.assertTrue(provisioned_secret.secret_value.startswith("hmswh_"))

        with patch(
            "app.modules.restaurants.integration_service._send_webhook_request",
            side_effect=[
                (
                    "failed",
                    500,
                    "Webhook returned HTTP 500.",
                    "server error",
                    90,
                ),
                (
                    "success",
                    200,
                    None,
                    "ok",
                    65,
                ),
            ],
        ):
            failed_delivery = integration_service.send_restaurant_test_webhook_delivery(
                self.db,
                restaurant_id=restaurant.id,
                current_user_id=self.current_super_admin.id,
            )
            retried_delivery = integration_service.retry_restaurant_webhook_delivery(
                self.db,
                restaurant_id=restaurant.id,
                delivery_id=failed_delivery.delivery.id,
                current_user_id=self.current_super_admin.id,
            )

        self.assertEqual(failed_delivery.delivery.delivery_status, "failed")
        self.assertEqual(retried_delivery.delivery.delivery_status, "success")
        self.assertTrue(retried_delivery.delivery.is_retry)
        self.assertEqual(
            retried_delivery.delivery.retried_from_delivery_id,
            failed_delivery.delivery.id,
        )

        ops = integration_service.get_restaurant_integration_ops(
            self.db,
            restaurant_id=restaurant.id,
        )
        self.assertTrue(ops.secret.has_secret)
        self.assertIsNotNone(ops.last_delivery)
        self.assertEqual(ops.last_delivery.id, retried_delivery.delivery.id)
        self.assertEqual(len(ops.recent_deliveries), 2)
        self.assertEqual(ops.recent_deliveries[0].id, retried_delivery.delivery.id)
        self.assertEqual(ops.recent_deliveries[1].id, failed_delivery.delivery.id)
        self.assertGreaterEqual(
            sum(point.failed_count for point in ops.failure_trend),
            1,
        )

        refreshed_restaurant = self.db.get(Restaurant, restaurant.id)
        assert refreshed_restaurant is not None
        self.assertEqual(refreshed_restaurant.integration_webhook_status.value, "healthy")

    def test_subscription_history_records_actor_and_reason(self) -> None:
        restaurant = self._create_active_restaurant()
        packages_service.ensure_default_packages(self.db)
        basic_package = packages_repository.get_package_by_code(self.db, "basic")
        standard_package = packages_repository.get_package_by_code(self.db, "standard")
        self.assertIsNotNone(basic_package)
        self.assertIsNotNone(standard_package)

        subscriptions_service.activate_paid_subscription(
            self.db,
            restaurant_id=restaurant.id,
            package_id=basic_package.id,  # type: ignore[union-attr]
        )
        self.db.commit()

        subscriptions_service.update_subscription_for_super_admin(
            self.db,
            restaurant.id,
            SuperAdminSubscriptionUpdateRequest(
                package_id=standard_package.id,  # type: ignore[union-attr]
                status="active",
                change_reason="Customer upgraded to a higher package.",
            ),
            actor_user_id=self.current_super_admin.id,
        )

        history = subscriptions_service.get_subscription_change_history_for_super_admin(
            self.db,
            restaurant.id,
            limit=10,
        )

        self.assertGreaterEqual(history.total, 2)
        latest = history.items[0]
        self.assertEqual(latest.action, "updated")
        self.assertEqual(latest.next_package_name, "Standard")
        self.assertEqual(latest.change_reason, "Customer upgraded to a higher package.")
        self.assertEqual(latest.actor.user_id, self.current_super_admin.id)

    def test_subscription_history_keeps_immutable_package_snapshots_after_package_rename(self) -> None:
        restaurant = self._create_active_restaurant()
        packages_service.ensure_default_packages(self.db)
        basic_package = packages_repository.get_package_by_code(self.db, "basic")
        standard_package = packages_repository.get_package_by_code(self.db, "standard")
        self.assertIsNotNone(basic_package)
        self.assertIsNotNone(standard_package)

        subscriptions_service.activate_paid_subscription(
            self.db,
            restaurant_id=restaurant.id,
            package_id=basic_package.id,  # type: ignore[union-attr]
        )
        self.db.commit()

        subscriptions_service.update_subscription_for_super_admin(
            self.db,
            restaurant.id,
            SuperAdminSubscriptionUpdateRequest(
                package_id=standard_package.id,  # type: ignore[union-attr]
                status="active",
                change_reason="Package rename regression guard.",
            ),
            actor_user_id=self.current_super_admin.id,
        )

        basic_package.name = "Legacy Basic"
        basic_package.code = "legacy-basic"
        standard_package.name = "Premium Standard"
        standard_package.code = "premium-standard"
        self.db.commit()

        history = subscriptions_service.get_subscription_change_history_for_super_admin(
            self.db,
            restaurant.id,
            limit=10,
        )

        latest = history.items[0]
        self.assertEqual(latest.previous_package_name, "Basic")
        self.assertEqual(latest.previous_package_code, "basic")
        self.assertEqual(latest.next_package_name, "Standard")
        self.assertEqual(latest.next_package_code, "standard")

    def test_notification_feed_surfaces_settings_and_subscription_events(self) -> None:
        restaurant = self._create_active_restaurant()
        owner = self._create_owner_for_restaurant(restaurant)
        packages_service.ensure_default_packages(self.db)
        basic_package = packages_repository.get_package_by_code(self.db, "basic")
        standard_package = packages_repository.get_package_by_code(self.db, "standard")
        self.assertIsNotNone(basic_package)
        self.assertIsNotNone(standard_package)

        subscriptions_service.activate_paid_subscription(
            self.db,
            restaurant_id=restaurant.id,
            package_id=basic_package.id,  # type: ignore[union-attr]
        )
        self.db.commit()

        settings_service.create_settings_request(
            self.db,
            restaurant_id=restaurant.id,
            requested_by=owner.id,
            payload=SettingsRequestCreateRequest(
                requested_changes={"reports": False},
                request_reason="Disable reports temporarily.",
            ),
        )
        subscriptions_service.update_subscription_for_super_admin(
            self.db,
            restaurant.id,
            SuperAdminSubscriptionUpdateRequest(
                package_id=standard_package.id,  # type: ignore[union-attr]
                status="active",
                change_reason="Align package with enterprise rollout.",
            ),
            actor_user_id=self.current_super_admin.id,
        )

        notifications = audit_logs_service.list_super_admin_notifications(self.db, limit=20)
        event_types = [item.event_type for item in notifications.items]

        self.assertIn("settings_request_submitted", event_types)
        self.assertIn("subscription_updated", event_types)

    def test_notification_queue_supports_assignment_read_acknowledge_and_snooze(self) -> None:
        restaurant = self._create_active_restaurant()
        owner = self._create_owner_for_restaurant(restaurant)
        assignee = users_service.create_platform_user(
            self.db,
            PlatformUserCreateRequest(
                full_name="Queue Admin",
                email="queue.admin@example.com",
                username="queue.admin",
                phone="0719999999",
                password="Password1",
                is_active=True,
                must_change_password=False,
                super_admin_scopes=["ops_viewer"],
            ),
            self.current_super_admin,
        )

        settings_service.create_settings_request(
            self.db,
            restaurant_id=restaurant.id,
            requested_by=owner.id,
            payload=SettingsRequestCreateRequest(
                requested_changes={"reports": False},
                request_reason="Queue action workflow coverage.",
            ),
        )

        notifications = audit_logs_service.list_super_admin_notifications(self.db, limit=20)
        target = next(
            item for item in notifications.items if item.event_type == "settings_request_submitted"
        )
        self.assertEqual(target.queue_status, "unread")
        self.assertFalse(target.is_read)

        assigned = audit_logs_service.update_super_admin_notification(
            self.db,
            target.id,
            SuperAdminNotificationUpdateRequest(
                assigned_user_id=assignee.id,
                is_read=True,
            ),
            self.current_super_admin,
        )
        self.assertTrue(assigned.is_read)
        self.assertEqual(assigned.assigned_to.user_id, assignee.id)
        self.assertEqual(assigned.queue_status, "assigned")

        snoozed = audit_logs_service.update_super_admin_notification(
            self.db,
            target.id,
            SuperAdminNotificationUpdateRequest(
                snoozed_until=datetime.now(UTC) + timedelta(hours=1),
            ),
            self.current_super_admin,
        )
        self.assertTrue(snoozed.is_snoozed)
        self.assertEqual(snoozed.queue_status, "snoozed")

        acknowledged = audit_logs_service.update_super_admin_notification(
            self.db,
            target.id,
            SuperAdminNotificationUpdateRequest(
                is_acknowledged=True,
                snoozed_until=None,
            ),
            self.current_super_admin,
        )
        self.assertTrue(acknowledged.is_acknowledged)
        self.assertFalse(acknowledged.is_snoozed)
        self.assertEqual(acknowledged.queue_status, "acknowledged")

    def test_review_history_lists_reviewed_records(self) -> None:
        restaurant, owner = self._create_pending_restaurant()

        with patch(
            "app.modules.restaurants.service.send_registration_approved_email",
            return_value=False,
        ), patch(
            "app.modules.restaurants.service.send_registration_approved_sms",
            return_value=False,
        ):
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
