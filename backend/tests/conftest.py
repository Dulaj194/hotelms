"""Pytest configuration and shared test fixtures for modular Clean Architecture testing."""
from collections.abc import Generator
import os
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Set test environment variables before any app imports
os.environ["APP_ENV"] = "testing"
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "sqlite+pysqlite:///:memory:",
)
os.environ["REDIS_URL"] = os.environ.get("TEST_REDIS_URL", "redis://localhost:6379")
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"

# Add backend to path
backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))

from app.api.router import router as api_router
from app.core import dependencies
from app.db.base import Base
from fastapi import FastAPI


def pytest_configure(config: pytest.Config) -> None:
    """Register custom markers to prevent Pytest UnknownMarkerWarning."""
    config.addinivalue_line("markers", "unit: Pure unit tests with mocked infrastructure layers.")
    config.addinivalue_line("markers", "integration: Integration tests executing against database layer.")
    config.addinivalue_line("markers", "slow: Execution-heavy or slow integration tests.")


@pytest.fixture(scope="session")
def db_engine():
    """Create a single shared in-memory SQLite engine for integration testing."""
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def db_session(db_engine) -> Generator[Session, None, None]:
    """Yield a fresh transactional database session for each test run."""
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=db_engine,
        expire_on_commit=False,
    )
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def test_app(db_session: Session) -> FastAPI:
    """Return a FastAPI test app with overridden infrastructure dependencies."""
    app = FastAPI()
    app.include_router(api_router)

    def override_get_db():
        yield db_session

    app.dependency_overrides[dependencies.get_db] = override_get_db
    mock_redis = MagicMock()
    app.dependency_overrides[dependencies.get_redis] = lambda: mock_redis

    return app


@pytest.fixture
def client(test_app: FastAPI) -> TestClient:
    """Return a configured TestClient leveraging standard overrides."""
    return TestClient(test_app)


# ─── Standard Auth & Role Fixtures ────────────────────────────────────────────

@pytest.fixture
def mock_super_admin():
    """Fixture providing a mock super admin identity."""
    return SimpleNamespace(
        id=1,
        email="super.admin@example.com",
        role=SimpleNamespace(value="super_admin"),
        restaurant_id=None,
        is_active=True,
    )


@pytest.fixture
def mock_restaurant_owner():
    """Fixture providing a mock restaurant owner identity linked to a tenant."""
    return SimpleNamespace(
        id=10,
        email="owner@restaurant.com",
        role=SimpleNamespace(value="owner"),
        restaurant_id=100,
        is_active=True,
    )


@pytest.fixture
def mock_restaurant_staff():
    """Fixture providing a mock staff user identity."""
    return SimpleNamespace(
        id=11,
        email="staff@restaurant.com",
        role=SimpleNamespace(value="steward"),
        restaurant_id=100,
        is_active=True,
    )
