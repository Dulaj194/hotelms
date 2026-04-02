import sys
import unittest
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

import app.db.init_models  # noqa: F401
from app.api.router import router as api_router  # noqa: E402
from app.core import dependencies  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.modules.site_content.model import ContactLead  # noqa: E402


class SiteContentPublicApiTests(unittest.TestCase):
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

        app = FastAPI()
        app.include_router(api_router)

        def override_get_db():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[dependencies.get_db] = override_get_db
        self.app = app
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        self.app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=self.engine)
        self.engine.dispose()

    def test_contact_submission_captures_attribution_fields(self) -> None:
        response = self.client.post(
            "/api/v1/public/site/contact",
            json={
                "full_name": "Demo Prospect",
                "email": "demo.prospect@example.com",
                "phone": "0771234567",
                "company_name": "Blue Harbor Hotel",
                "property_type": "hotel",
                "subject": "Need demo",
                "message": "Please show our team room service, cashier handoff, and reporting on mobile devices.",
                "source_page": "blog",
                "source_path": "/contact?utm_source=google&utm_campaign=spring-demo",
                "entry_point": "blog_bottom_cta",
                "login_intent": "accountant",
                "referrer_url": "https://google.com/search?q=hotel+billing+software",
                "utm_source": "google",
                "utm_medium": "cpc",
                "utm_campaign": "spring-demo",
                "utm_term": "hotel billing software",
                "utm_content": "article-footer",
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertGreater(payload["id"], 0)

        db = self.SessionLocal()
        lead = db.query(ContactLead).filter(ContactLead.id == payload["id"]).first()
        self.assertIsNotNone(lead)
        assert lead is not None
        self.assertEqual(lead.source_page, "blog")
        self.assertEqual(lead.entry_point, "blog_bottom_cta")
        self.assertEqual(lead.login_intent, "accountant")
        self.assertEqual(lead.utm_source, "google")
        self.assertEqual(lead.utm_campaign, "spring-demo")
        self.assertIn("/contact?", lead.source_path or "")
        db.close()

    def test_blog_listing_supports_search_and_category_filters(self) -> None:
        response = self.client.get("/api/v1/public/site/blogs?search=room&category=Operations")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["page_title"], "Hospitality Insights and Practical Guides")
        self.assertIn("categories", payload)
        self.assertIn("items", payload)


if __name__ == "__main__":
    unittest.main()
