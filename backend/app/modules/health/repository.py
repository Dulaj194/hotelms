import redis as redis_lib
from sqlalchemy import text
from sqlalchemy.orm import Session


def check_database(db: Session) -> str:
    """Return 'ok' if the database is reachable, otherwise 'unavailable'."""
    try:
        db.execute(text("SELECT 1"))
        return "ok"
    except Exception:
        return "unavailable"


def check_redis(redis_client: redis_lib.Redis) -> str:
    """Return 'ok' if Redis is reachable, otherwise 'unavailable'."""
    try:
        redis_client.ping()
        return "ok"
    except Exception:
        return "unavailable"
