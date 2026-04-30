"""Rate limiting using Redis."""
import redis
from fastapi import HTTPException, Request, status


async def check_rate_limit(
    redis_client: redis.Redis | None,
    request: Request,
    max_attempts: int,
    window_minutes: int,
) -> None:
    """Check if request is within rate limit.
    
    Args:
        redis_client: Redis connection, or None if unavailable
        request: FastAPI request
        max_attempts: Maximum attempts allowed
        window_minutes: Time window in minutes
        
    Raises:
        HTTPException: If rate limit exceeded (429)
        
    Note: If redis_client is None, rate limiting is skipped (fails open)
    """
    if redis_client is None:
        # Redis unavailable - skip rate limiting to allow requests through
        return
    
    if not request.client:
        return
    
    client_ip = request.client.host
    endpoint = request.url.path
    key = f"rate_limit:{endpoint}:{client_ip}"
    
    try:
        current = redis_client.get(key)
        attempts = int(current) if current else 0
        
        if attempts >= max_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many attempts. Try again in {window_minutes} minutes.",
            )
        
        # Increment and set expiry
        redis_client.incr(key)
        redis_client.expire(key, window_minutes * 60)
        
    except HTTPException:
        raise
    except Exception:
        # If Redis fails, allow the request (fail open)
        pass

