from collections.abc import Generator
from datetime import UTC, datetime, timedelta

import redis as redis_lib
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.redis import get_redis_client
from app.db.session import SessionLocal

_bearer = HTTPBearer()

_AUTH_SELF_SERVICE_ALLOWED_PATHS = {
    "/api/v1/auth/me",
    "/api/v1/auth/logout",
    "/api/v1/auth/change-initial-password",
    "/api/v1/auth/refresh",
}


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
    request: Request = None,
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

    request_path = request.url.path if request else None

    if user.restaurant_id is not None:
        from app.modules.auth.service import _assert_role_feature_access
        from app.modules.restaurants.model import RegistrationStatus, Restaurant

        restaurant = db.query(Restaurant).filter(Restaurant.id == user.restaurant_id).first()
        if request_path not in _AUTH_SELF_SERVICE_ALLOWED_PATHS:
            if restaurant is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your restaurant account is unavailable.",
                )
            if restaurant.registration_status == RegistrationStatus.PENDING:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your registration is pending super admin approval.",
                )
            if restaurant.registration_status == RegistrationStatus.REJECTED:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your registration was rejected. Please contact support.",
                )
            if not restaurant.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your restaurant account is inactive.",
                )
            _assert_role_feature_access(user, restaurant)

    if user.must_change_password:
        if request_path not in _AUTH_SELF_SERVICE_ALLOWED_PATHS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Password change required before accessing this resource.",
            )

    return user


def require_roles(*roles: object):
    """Dependency factory that enforces role-based access control."""

    normalized_roles = {
        str(role.value if hasattr(role, "value") else role).strip().lower()
        for role in roles
        if role
    }

    def _check(current_user=Depends(get_current_user)):
        current_role = str(
            current_user.role.value if hasattr(current_user.role, "value") else current_user.role
        ).strip().lower()
        if current_role not in normalized_roles:
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


def get_current_subscription(
    db: Session = Depends(get_db),
    restaurant_user=Depends(require_restaurant_user),
):
    """Return current restaurant subscription snapshot from centralized service."""
    from app.modules.subscriptions import service as subscription_service

    return subscription_service.get_current_subscription(db, restaurant_user.restaurant_id)


def require_active_subscription(
    db: Session = Depends(get_db),
    restaurant_user=Depends(require_restaurant_user),
):
    """Ensure restaurant has active/trial non-expired subscription."""
    from app.modules.subscriptions import service as subscription_service

    status_response = subscription_service.get_current_subscription_status(
        db,
        restaurant_user.restaurant_id,
    )
    if not status_response.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An active subscription is required for this feature.",
        )
    return status_response


def require_privilege(privilege_code: str):
    """Dependency factory to enforce a SaaS privilege for authenticated tenant routes."""

    def _check(
        db: Session = Depends(get_db),
        restaurant_id: int = Depends(get_current_restaurant_id),
    ):
        if restaurant_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No restaurant context available for privilege check.",
            )

        from app.modules.subscriptions import service as subscription_service

        subscription_service.assert_privilege(db, restaurant_id, privilege_code)
        return True

    return _check


def require_platform_scopes(*scopes: str):
    """Dependency factory that enforces super-admin scope-based access."""

    normalized_scopes = tuple(dict.fromkeys(scope.strip().lower() for scope in scopes if scope))

    def _check(current_user=Depends(get_current_user)):
        from app.modules.platform_access import catalog as platform_access_catalog
        from app.modules.users.model import UserRole

        if current_user.role != UserRole.super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )

        if not platform_access_catalog.user_has_any_platform_scope(
            current_user,
            normalized_scopes,
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your platform account does not have the required permission scope.",
            )
        return current_user

    return _check


def require_platform_action(resource: str, action: str):
    """Dependency factory that enforces platform permission matrix actions."""

    from app.modules.platform_access import matrix as platform_access_matrix

    required_scopes = platform_access_matrix.get_required_scopes_for_action(
        resource,
        action,
    )
    if required_scopes is None:
        raise ValueError(
            f"Unknown platform permission mapping for resource='{resource}' action='{action}'."
        )

    return require_platform_scopes(*required_scopes)


def require_module_access(module_key: str):
    """Dependency factory to enforce effective module access for tenant routes."""

    def _check(
        db: Session = Depends(get_db),
        restaurant_id: int = Depends(get_current_restaurant_id),
    ):
        if restaurant_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No restaurant context available for module access check.",
            )

        from app.modules.subscriptions import service as subscription_service

        subscription_service.assert_module_access(db, restaurant_id, module_key)
        return True

    return _check


def require_room_session_privilege(privilege_code: str):
    """Dependency factory for guest room-session routes that need privilege gates."""

    def _check(
        db: Session = Depends(get_db),
        session=Depends(get_current_room_session),
    ):
        from app.modules.subscriptions import service as subscription_service

        subscription_service.assert_privilege(db, session.restaurant_id, privilege_code)
        return True

    return _check


def require_room_module_access(module_key: str):
    """Dependency factory for guest room-session routes that need module gates."""

    def _check(
        db: Session = Depends(get_db),
        session=Depends(get_current_room_session),
    ):
        from app.modules.subscriptions import service as subscription_service

        subscription_service.assert_module_access(db, session.restaurant_id, module_key)
        return True

    return _check


# ─── Guest session dependency ─────────────────────────────────────────────────
#
# DESIGN: Guest (customer) tokens are carried in the X-Guest-Session header
# and are completely separate from staff Bearer tokens. They encode
# session_id + restaurant_id + table_number and are signed with the same
# secret key but carry type="guest_session" to prevent cross-use with
# staff tokens.

from fastapi import Header  # noqa: E402 — local import to avoid circular at module load


def get_current_guest_session(
    x_guest_session: str = Header(..., alias="X-Guest-Session"),
    db: Session = Depends(get_db),
):
    """Dependency that validates the X-Guest-Session token and returns the TableSession.

    Used by all cart endpoints. Validates:
    1. Token signature and expiry (jose).
    2. Token type is 'guest_session' (not a staff token).
    3. Session exists in DB and is active/not-expired.
    """
    from app.core.security import decode_guest_session_token
    from app.modules.table_sessions.repository import get_active_session_by_session_id

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired guest session.",
        headers={"WWW-Authenticate": "X-Guest-Session"},
    )

    try:
        payload = decode_guest_session_token(x_guest_session)
    except Exception:
        raise credentials_exception

    session_id: str | None = payload.get("session_id")
    if not session_id:
        raise credentials_exception

    session = get_active_session_by_session_id(db, session_id)
    if session is None:
        raise credentials_exception

    # Defense in depth: token context must match persisted session context.
    try:
        token_restaurant_id = int(payload.get("restaurant_id"))
    except (TypeError, ValueError):
        raise credentials_exception
    token_table_number = str(payload.get("table_number", "")).strip()

    if (
        token_restaurant_id != session.restaurant_id
        or token_table_number != session.table_number
    ):
        raise credentials_exception

    return session


def get_current_room_session(
    x_room_session: str = Header(..., alias="X-Room-Session"),
    db: Session = Depends(get_db),
):
    """Dependency that validates the X-Room-Session token and returns the RoomSession.

    Used by all room cart and room order endpoints. Validates:
    1. Token signature and expiry (jose).
    2. Token type is 'room_session' (not a staff or table token).
    3. Session exists in DB and is active/not-expired.

    SECURITY: Plain room_number alone never authorizes room operations.
    Only a valid signed room session token grants access.
    """
    from app.core.security import decode_room_session_token
    from app.modules.room_sessions.repository import get_active_room_session_by_session_id

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired room session.",
        headers={"WWW-Authenticate": "X-Room-Session"},
    )

    try:
        payload = decode_room_session_token(x_room_session)
    except Exception:
        raise credentials_exception

    session_id: str | None = payload.get("session_id")
    if not session_id:
        raise credentials_exception

    session = get_active_room_session_by_session_id(db, session_id)
    if session is None:
        raise credentials_exception

    idle_timeout_minutes = max(settings.room_session_idle_timeout_minutes, 1)
    last_activity_at = session.last_activity_at
    if last_activity_at.tzinfo is None:
        last_activity_at = last_activity_at.replace(tzinfo=UTC)

    if last_activity_at + timedelta(minutes=idle_timeout_minutes) <= datetime.now(UTC):
        from app.modules.room_sessions.repository import deactivate_room_session

        deactivate_room_session(
            db,
            session_id=session.session_id,
            restaurant_id=session.restaurant_id,
        )
        raise credentials_exception

    from app.modules.room_sessions.repository import touch_room_session_activity

    touch_room_session_activity(
        db,
        session_id=session.session_id,
        restaurant_id=session.restaurant_id,
    )

    return session
