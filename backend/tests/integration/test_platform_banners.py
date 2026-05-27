import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

import app.db.init_models  # noqa: F401
from app.db.base import Base
from app.core import dependencies
from app.core.security import hash_password
from app.modules.users.model import User, UserRole
from app.modules.platform_banners.model import PlatformBanner, BannerCategory, BannerType
from app.modules.platform_banners import service
from app.modules.platform_banners.schemas import PlatformBannerCreate, PlatformBannerUpdate
from app.main import app as fastapi_app


class PlatformBannersIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        # Create transactional in-memory SQLite for high-speed, isolated testing
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

        # Seed mock Super Admin with appropriate management roles
        self.current_super_admin = User(
            full_name="Platform Chief Operator",
            email="ops.chief@example.com",
            password_hash=hash_password("SecuredPass123"),
            role=UserRole.super_admin,
            restaurant_id=None,
            is_active=True,
            platform_scopes_json='["tenant_admin", "ops_viewer"]'
        )

        self.db.add(self.current_super_admin)
        self.db.commit()
        self.db.refresh(self.current_super_admin)

        # Configure FastAPI TestClient
        self.client = TestClient(fastapi_app)

        # Override FastAPI dependencies for database connection and security scopes
        def override_get_db():
            yield self.db

        def override_require_platform_tenant_admin():
            return self.current_super_admin

        def override_require_platform_ops_viewer():
            return self.current_super_admin

        def override_get_current_user():
            return self.current_super_admin

        fastapi_app.dependency_overrides[dependencies.get_db] = override_get_db
        # We target the specific parameter-bound call returned by require_platform_scopes
        # Since python functions returned dynamically can be hard to match, we can override get_current_user
        # and standard security gates directly:
        fastapi_app.dependency_overrides[dependencies.get_current_user] = override_get_current_user

    def tearDown(self) -> None:
        fastapi_app.dependency_overrides.clear()
        self.db.close()
        self.engine.dispose()

    def test_banner_crud_service_flow(self) -> None:
        """Validate core service creation, listing, updating and deletion logic."""
        # 1. Create Promotional Banner
        banner_payload = PlatformBannerCreate(
            title="Refer and Earn!",
            content="Get your friends registered and enjoy 20% discount on POS module.",
            category=BannerCategory.promotional,
            type=BannerType.success,
            image_url="https://media.hotelms.com/referrals.png",
            cta_link="https://hotelms.com/referral-invite",
            cta_label="Invite Hoteliers",
            is_active=True,
            dismissible=True
        )

        db_banner = service.create_platform_banner(self.db, banner_payload, self.current_super_admin.id)
        self.assertEqual(db_banner.title, "Refer and Earn!")
        self.assertEqual(db_banner.category, BannerCategory.promotional)
        self.assertEqual(db_banner.type, BannerType.success)

        # 2. Update Details
        update_payload = PlatformBannerUpdate(
            title="Refer and Earn Big!",
            type=BannerType.info
        )
        updated = service.update_platform_banner(self.db, db_banner.id, update_payload)
        self.assertEqual(updated.title, "Refer and Earn Big!")
        self.assertEqual(updated.type, BannerType.info)

        # 3. Retrieve Detail
        retrieved = service.get_banner(self.db, db_banner.id)
        self.assertEqual(retrieved.id, db_banner.id)

        # 4. Delete Detail
        service.delete_platform_banner(self.db, db_banner.id)
        with self.assertRaises(Exception):
            service.get_banner(self.db, db_banner.id)

    def test_active_scheduled_banners_timing_checks(self) -> None:
        """Verify that inactive or unscheduled banners are omitted from active delivery."""
        now = datetime.utcnow()

        # Inactive Banner
        service.create_platform_banner(
            self.db,
            PlatformBannerCreate(
                title="Hidden Banner",
                content="This should not show",
                category=BannerCategory.promotional,
                is_active=False
            ),
            self.current_super_admin.id
        )

        # Future Scheduled Banner
        service.create_platform_banner(
            self.db,
            PlatformBannerCreate(
                title="Future Upgrade",
                content="Server maintenance scheduled in 3 days",
                category=BannerCategory.system_alert,
                is_active=True,
                starts_at=now + timedelta(days=2),
                ends_at=now + timedelta(days=4)
            ),
            self.current_super_admin.id
        )

        # Currently Active Banners
        service.create_platform_banner(
            self.db,
            PlatformBannerCreate(
                title="Active Promo",
                content="Referral campaign",
                category=BannerCategory.promotional,
                is_active=True,
                starts_at=now - timedelta(days=1),
                ends_at=now + timedelta(days=1)
            ),
            self.current_super_admin.id
        )
        service.create_platform_banner(
            self.db,
            PlatformBannerCreate(
                title="Active Warning",
                content="System running on backup cluster",
                category=BannerCategory.system_alert,
                is_active=True,
                starts_at=now - timedelta(days=1)
            ),
            self.current_super_admin.id
        )

        # Query active grouped banners
        grouped = service.get_active_banners_grouped(self.db)
        
        # Verify inactive and future banners are filtered out correctly
        self.assertEqual(len(grouped.promotional), 1)
        self.assertEqual(grouped.promotional[0].title, "Active Promo")
        
        self.assertEqual(len(grouped.system_alert), 1)
        self.assertEqual(grouped.system_alert[0].title, "Active Warning")

    def test_endpoint_retrieval_active_banners(self) -> None:
        """Call active delivery endpoint via client router and verify response grouping."""
        # Seeding one active promotional and one active alert banner
        service.create_platform_banner(
            self.db,
            PlatformBannerCreate(
                title="Discover PMS",
                content="Try our premium PMS",
                category=BannerCategory.promotional,
                is_active=True
            ),
            self.current_super_admin.id
        )
        service.create_platform_banner(
            self.db,
            PlatformBannerCreate(
                title="Status Stable",
                content="All services operational",
                category=BannerCategory.system_alert,
                is_active=True
            ),
            self.current_super_admin.id
        )

        # GET request to client delivery endpoint
        response = self.client.get("/api/v1/dashboard/banners/active")
        self.assertEqual(response.status_code, 200)
        
        payload = response.json()
        self.assertTrue(payload["success"])
        
        data = payload["data"]
        self.assertIn("promotional", data)
        self.assertIn("system_alert", data)
        
        self.assertEqual(len(data["promotional"]), 1)
        self.assertEqual(data["promotional"][0]["title"], "Discover PMS")
        
        self.assertEqual(len(data["system_alert"]), 1)
        self.assertEqual(data["system_alert"][0]["title"], "Status Stable")


if __name__ == "__main__":
    unittest.main()
