from collections.abc import Generator

import redis as redis_lib
from sqlalchemy.orm import Session

from app.db.redis import get_redis_client
from app.db.session import SessionLocal


def get_db() -> Generator[Session, None, None]:
    """Yield a SQLAlchemy database session and ensure it is closed afterward."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_redis() -> redis_lib.Redis:
    """Return the shared Redis client instance."""
    return get_redis_client()
