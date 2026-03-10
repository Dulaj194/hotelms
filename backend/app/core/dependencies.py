from collections.abc import Generator

import redis as redis_lib
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.db.redis import get_redis_client
from app.db.session import SessionLocal

_bearer = HTTPBearer()


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


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
):
    """FastAPI dependency that validates the bearer access token and returns the User."""
    from app.core.security import decode_token
    from app.modules.users.model import User

    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type.",
        )

    user_id = int(payload["sub"])
    user: User | None = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive.",
        )

    return user


def require_roles(*roles: str):
    """Dependency factory that enforces role-based access control."""

    def _check(current_user=Depends(get_current_user)):
        if current_user.role.value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )
        return current_user

    return _check


# ─── Tenant-aware dependencies ───────────────────────────────────────────────────────
#
# DESIGN RULE: These helpers are the single source of truth for tenant context.
# Protected routes must use these dependencies — they must NEVER accept
# restaurant_id from request body, query params, or URL path for authenticated
# tenant operations. The authenticated JWT → DB user record is the only
# trusted source of restaurant context.


def get_current_restaurant_id(
    current_user=Depends(get_current_user),
) -> int | None:
    """
    TENANT SECURITY: Derives restaurant context from the authenticated user.

    The restaurant_id is read from the DB-backed User object, which was loaded
    using the verified JWT subject claim. It is never derived from any
    client-supplied value.

    - super_admin: returns restaurant_id (may be None — platform-level admin)
    - tenant-bound users: returns restaurant_id, or raises 403 if unlinked
    """
    from app.modules.users.model import UserRole

    if current_user.role == UserRole.super_admin:
        # super_admin may operate without a restaurant context
        return current_user.restaurant_id

    if current_user.restaurant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not linked to a restaurant.",
        )

    return current_user.restaurant_id


def require_restaurant_user(
    current_user=Depends(get_current_user),
):
    """
    TENANT SECURITY: Ensures the caller belongs to a restaurant.

    Use on all endpoints that must only be accessed by restaurant-bound staff
    (owner, admin, steward, housekeeper). Rejects any user — including
    super_admin — whose restaurant_id is None.

    Returns the authenticated User object for use in the route handler.
    The handler can safely read current_user.restaurant_id without a None check.
    """
    if current_user.restaurant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint requires a restaurant-bound account.",
        )
    return current_user

    return _check
