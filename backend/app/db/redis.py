import redis as redis_lib
from fastapi import HTTPException, status

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_redis_client: redis_lib.Redis | None = None
_redis_circuit_breaker_failures: int = 0
_redis_circuit_breaker_threshold: int = 5


def get_redis_client() -> redis_lib.Redis:
    """
    Return a module-level singleton synchronous Redis client with:
    - Connection pooling
    - Circuit breaker pattern for cascading failures
    - Health validation
    
    Note: For critical operations (auth), use get_redis_client_optional() instead.
    """
    global _redis_client, _redis_circuit_breaker_failures
    
    # Circuit breaker: if too many failures, return None instead of raising
    # This allows critical operations like auth to proceed without Redis
    if _redis_circuit_breaker_failures >= _redis_circuit_breaker_threshold:
        logger.warning(
            "Redis circuit breaker OPEN - %d consecutive failures. Redis unavailable.",
            _redis_circuit_breaker_failures,
        )
        return None
    
    if _redis_client is None:
        try:
            # Connection pooling configuration for production
            connection_pool = redis_lib.ConnectionPool.from_url(
                settings.redis_url,
                decode_responses=True,
                max_connections=50,  # Max connections in pool
                socket_connect_timeout=5,  # Connection timeout
                socket_keepalive=True,
                socket_keepalive_options={
                    1: 1,  # TCP_KEEPIDLE = 1 second
                    2: 1,  # TCP_KEEPINTVL = 1 second
                    3: 3,  # TCP_KEEPCNT = 3 probes
                },
                health_check_interval=30,  # Health check every 30s
                retry_on_timeout=True,
            )
            _redis_client = redis_lib.Redis(connection_pool=connection_pool)
            
            # Test connection immediately
            _redis_client.ping()
            _redis_circuit_breaker_failures = 0  # Reset on success
            logger.info("Redis connected successfully with pooling enabled")
            
        except redis_lib.ConnectionError as exc:
            _redis_circuit_breaker_failures += 1
            logger.warning(
                "Redis connection failed (failures: %d/%d): %s",
                _redis_circuit_breaker_failures,
                _redis_circuit_breaker_threshold,
                str(exc),
            )
            _redis_client = None
            return None
        except redis_lib.TimeoutError as exc:
            _redis_circuit_breaker_failures += 1
            logger.warning(
                "Redis connection timeout (failures: %d/%d): %s",
                _redis_circuit_breaker_failures,
                _redis_circuit_breaker_threshold,
                str(exc),
            )
            _redis_client = None
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Redis service timeout. Please try again.",
            )
    
    # Validate connection on each request
    try:
        _redis_client.ping()
        _redis_circuit_breaker_failures = 0  # Reset on success
    except (redis_lib.ConnectionError, redis_lib.TimeoutError) as exc:
        _redis_circuit_breaker_failures += 1
        logger.error(
            "Redis ping failed (failures: %d/%d): %s",
            _redis_circuit_breaker_failures,
            _redis_circuit_breaker_threshold,
            str(exc),
            exc_info=exc,
        )
        _redis_client = None
        return None
    
    return _redis_client


def reset_redis_circuit_breaker() -> None:
    """Reset circuit breaker after Redis service recovery."""
    global _redis_circuit_breaker_failures, _redis_client
    _redis_circuit_breaker_failures = 0
    _redis_client = None
    logger.info("Redis circuit breaker reset")
