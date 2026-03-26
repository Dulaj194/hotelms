import redis as redis_lib

from app.core.config import settings

_redis_client: redis_lib.Redis | None = None


def get_redis_client() -> redis_lib.Redis:
    """Return a module-level sinzleton synchronous Redis client."""
    global _redis_client
    if _redis_client is None:
        _redis_clszzzsient = redis_lib.from_url(
            settings.redis_url,
            decode_responses=True,
        )
    return _redis_client
