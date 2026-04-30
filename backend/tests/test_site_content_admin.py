import sys
import json
import unittest
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

import app.db.init_models  # noqa: F401
from app.core.security import hash_password  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.modules.audit_logs.model import AuditLog, SuperAdminNotificationState  # noqa: E402
from app.modules.site_content import service as site_content_service  # noqa: E402
from app.modules.site_content.schemas import (  # noqa: E402
    AdminBlogPostUpsertRequest,
    AdminContactLeadUpdateRequest,
    AdminSitePageUpdateRequest,
    ContactLeadCreateRequest,
)
from app.modules.users.model import User, UserRole  # noqa: E402


class SiteContentAdminTests(unittest.TestCase):
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
            full_name="Tenant Admin Root",
            email="tenant.admin.root@example.com",
            password_hash=hash_password("Password1"),
            role=UserRole.super_admin,
            restaurant_id=None,
            is_active=True,
        )
        self.current_super_admin.set_super_admin_scopes(["tenant_admin"])
        self.db.add(self.current_super_admin)

        self.assignee = User(
            full_name="Lead Owner",
            email="lead.owner@example.com",
            password_hash=hash_password("Password1"),
            role=UserRole.super_admin,
            restaurant_id=None,
            is_active=True,
        )
        self.assignee.set_super_admin_scopes(["tenant_admin"])
        self.db.add(self.assignee)
        self.db.commit()
        self.db.refresh(self.current_super_admin)
        self.db.refresh(self.assignee)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_page_draft_and_publish_flow_tracks_admin_metadata(self) -> None:
        page = site_content_service.get_site_page_admin(self.db, "about")
        payload = dict(page.payload)
        payload["hero_title"] = "Built for hospitality teams that need stronger execution"

        updated = site_content_service.update_site_page_admin(
            self.db,
            slug="about",
            payload=AdminSitePageUpdateRequest(
                title="About R.LUMINUOUS",
                summary="Updated about page summary",
                payload=payload,
            ),
            current_user=self.current_super_admin,
        )

        self.assertEqual(
            updated.payload["hero_title"],
            "Built for hospitality teams that need stronger execution",
        )
        self.assertEqual(updated.updated_by.user_id, self.current_super_admin.id)

        unpublished = site_content_service.unpublish_site_page_admin(
            self.db,
            slug="about",
            current_user=self.current_super_admin,
        )
        self.assertFalse(unpublished.is_published)

        published = site_content_service.publish_site_page_admin(
            self.db,
            slug="about",
            current_user=self.current_super_admin,
        )
        self.assertTrue(published.is_published)
        self.assertIsNotNone(published.last_published_at)
        self.assertEqual(published.published_by.user_id, self.current_super_admin.id)
        self.assertEqual(
            published.published_payload["hero_title"],
            "Built for hospitality teams that need stronger execution",
        )

    def test_blog_publish_and_lead_inbox_flow_support_assignment_and_export(self) -> None:
        created_post = site_content_service.create_blog_post_admin(
            self.db,
            payload=AdminBlogPostUpsertRequest(
                slug="folio-handoff-checklist",
                title="Folio Handoff Checklist For Hotel Cashiers",
                excerpt="A checklist for moving room charges from cashier review to accountant-ready completion.",
                category="Billing",
                cover_image_url=None,
                tags=["folio", "cashier", "accountant"],
                body=[
                    "Start with the latest room summary before moving any charge into settlement.",
                    "Use a visible handoff checkpoint so finance teams know exactly where the bill sits.",
                ],
                key_takeaways=[
                    "Keep room settlements visible",
                    "Assign clear ownership between cashier and accountant",
                ],
                reading_minutes=6,
                is_featured=True,
                scheduled_publish_at=None,
            ),
            current_user=self.current_super_admin,
        )

        self.assertFalse(created_post.is_published)

        published_post = site_content_service.publish_blog_post_admin(
            self.db,
            slug=created_post.slug,
            current_user=self.current_super_admin,
        )
        self.assertTrue(published_post.is_published)
        self.assertEqual(published_post.published_by.user_id, self.current_super_admin.id)

        created_lead = site_content_service.submit_contact_lead(
            self.db,
            ContactLeadCreateRequest(
                full_name="Hotel Prospect",
                email="prospect@example.com",
                phone="0779991234",
                company_name="Harbor Lights Hotel",
                property_type="hotel",
                subject="Need room billing demo",
                message="Please show us room service ordering, folio settlement, and lead follow-up workflows.",
                source_page="contact",
                source_path="/contact?utm_source=google&utm_campaign=hotel-demo",
                entry_point="blog_bottom_cta",
                login_intent="cashier",
                referrer_url="https://google.com/search?q=hotel+software",
                utm_source="google",
                utm_medium="cpc",
                utm_campaign="hotel-demo",
                utm_term="hotel software",
                utm_content="room-folio-cta",
            ),
        )
        self.assertGreater(created_lead.id, 0)

        updated_lead = site_content_service.update_contact_lead_admin(
            self.db,
            lead_id=created_lead.id,
            payload=AdminContactLeadUpdateRequest(
                status="qualified",
                assigned_to_user_id=self.assignee.id,
                internal_notes="Qualified after rollout scoping call.",
            ),
            current_user=self.current_super_admin,
        )
        self.assertEqual(updated_lead.status.value, "qualified")
        self.assertEqual(updated_lead.assigned_to.user_id, self.assignee.id)

        lead_list = site_content_service.list_contact_leads_admin(
            self.db,
            status_filter="qualified",
            assigned_to_user_id=self.assignee.id,
        )
        self.assertEqual(lead_list.total, 1)
        self.assertEqual(lead_list.items[0].email, "prospect@example.com")
        self.assertEqual(lead_list.summary.qualified_count, 1)
        self.assertEqual(lead_list.items[0].entry_point, "blog_bottom_cta")
        self.assertEqual(lead_list.items[0].utm_source, "google")
        self.assertEqual(lead_list.items[0].login_intent, "cashier")

        admin_users = site_content_service.list_site_content_admin_users(self.db)
        self.assertEqual(admin_users.total, 2)

        csv_output = site_content_service.export_contact_leads_csv(
            self.db,
            status_filter="qualified",
            assigned_to_user_id=self.assignee.id,
        )
        self.assertIn("Harbor Lights Hotel", csv_output)
        self.assertIn("Lead Owner", csv_output)
        self.assertIn("blog_bottom_cta", csv_output)
        self.assertIn("hotel-demo", csv_output)

    def test_site_content_admin_mutations_emit_forensic_audit_and_notifications(self) -> None:
        page = site_content_service.get_site_page_admin(self.db, "about")
        payload = dict(page.payload)
        payload["hero_title"] = "Auditable Site Content Governance"

        site_content_service.update_site_page_admin(
            self.db,
            slug="about",
            payload=AdminSitePageUpdateRequest(
                title="About R.LUMINUOUS",
                summary="Audit ready page update",
                payload=payload,
                reason="Corrected public positioning text.",
            ),
            current_user=self.current_super_admin,
        )

        draft = site_content_service.create_blog_post_admin(
            self.db,
            payload=AdminBlogPostUpsertRequest(
                slug="audit-ready-site-content",
                title="Audit Ready Site Content Operations",
                excerpt="Documenting approval-ready CMS controls for operations and compliance teams.",
                category="Governance",
                cover_image_url=None,
                tags=["audit", "governance"],
                body=["Capture every content lifecycle action with actor and context."],
                key_takeaways=["Store before and after payload snapshots"],
                reading_minutes=5,
                is_featured=False,
                scheduled_publish_at=None,
                reason="Publishing pipeline dry-run for audit readiness.",
            ),
            current_user=self.current_super_admin,
        )

        created_lead = site_content_service.submit_contact_lead(
            self.db,
            ContactLeadCreateRequest(
                full_name="Ops Auditor",
                email="ops.auditor@example.com",
                phone="0775550000",
                company_name="Audit Hotel",
                property_type="hotel",
                subject="Need governance workflow",
                message="Please share your CMS governance controls and notification queue workflow.",
            ),
        )

        site_content_service.update_contact_lead_admin(
            self.db,
            lead_id=created_lead.id,
            payload=AdminContactLeadUpdateRequest(
                status="reviewed",
                assigned_to_user_id=self.assignee.id,
                internal_notes="Review completed with governance checklist.",
                reason="Lead triage completed by duty admin.",
            ),
            current_user=self.current_super_admin,
        )

        for event_type in (
            "site_page_updated",
            "site_blog_created",
            "site_contact_lead_updated",
        ):
            log = (
                self.db.query(AuditLog)
                .filter(AuditLog.event_type == event_type)
                .order_by(AuditLog.id.desc())
                .first()
            )
            self.assertIsNotNone(log)
            assert log is not None

            metadata = json.loads(log.metadata_json or "{}")
            self.assertIn("reason", metadata)
            self.assertIn("before", metadata)
            self.assertIn("after", metadata)
            self.assertIn("delta", metadata)
            self.assertIn("delta_field_count", metadata)
            self.assertIsInstance(metadata["delta"], dict)

            notification_state = (
                self.db.query(SuperAdminNotificationState)
                .filter(SuperAdminNotificationState.audit_log_id == log.id)
                .first()
            )
            self.assertIsNotNone(notification_state)

        self.assertEqual(draft.slug, "audit-ready-site-content")


if __name__ == "__main__":
    unittest.main()
