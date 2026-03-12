import redis as redis_lib
import redis.asyncio as aioredis

from app.core.config import settings

_redis_client: redis_lib.Redis | None = None


def get_redis_client() -> redis_lib.Redis:
    """Return a module-level singleton synchronous Redis client.

    The client is created lazily on first access so that import-time
    errors are avoided when Redis is not yet available.
    """
    global _redis_client
    if _redis_client is None:
        _redis_client = redis_lib.from_url(
            settings.redis_url,
            decode_responses=True,
        )
    return _redis_client


def create_async_redis_client() -> aioredis.Redis:
    """Create a new async Redis client instance.

    Returns a fresh client each call — async clients are created per-use
    (e.g., one per WebSocket connection) and must be closed by the caller.
    """
    return aioredis.from_url(settings.redis_url, decode_responses=True)
