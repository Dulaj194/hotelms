"""Pytest configuration and fixtures for tests."""
import os
import sys
from pathlib import Path

# Set test environment variables before any app imports
os.environ["APP_ENV"] = "testing"
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "mysql+pymysql://root:@localhost:3306/hotelms_test",
)
os.environ["REDIS_URL"] = os.environ.get("TEST_REDIS_URL", "redis://localhost:6379")
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"

# Add backend to path
backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))
