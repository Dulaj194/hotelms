import redis as redis_lib
from fastapi import HTTPException, status

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_redis_client: redis_lib.Redis | None = None


def get_redis_client() -> redis_lib.Redis:
    """Return a module-level singleton synchronous Redis client with connection validation."""
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis_lib.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=5,  # 5 second timeout
                socket_keepalive=True,
                health_check_interval=30,
            )
            # Test connection immediately
            _redis_client.ping()
            logger.info("Redis connected successfully: %s", settings.redis_url)
        except redis_lib.ConnectionError as exc:
            logger.error("Redis connection failed: %s", str(exc), exc_info=exc)
            _redis_client = None
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Redis service unavailable. Please try again.",
            )
        except redis_lib.TimeoutError as exc:
            logger.error("Redis connection timeout: %s", str(exc), exc_info=exc)
            _redis_client = None
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Redis service timeout. Please try again.",
            )
    
    # Validate connection on each request
    try:
        _redis_client.ping()
    except (redis_lib.ConnectionError, redis_lib.TimeoutError) as exc:
        logger.error("Redis ping failed: %s", str(exc), exc_info=exc)
        _redis_client = None
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis service unavailable. Please try again.",
        )
    
    return _redis_client
