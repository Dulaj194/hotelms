import uuid
from datetime import UTC, datetime, timedelta, timezone

import redis as redis_lib
from fastapi import HTTPException, Response, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_secure_token,
    hash_token,
    hash_password,
    verify_password,
)
from app.modules.audit_logs.service import write_audit_log
from app.modules.auth.repository import (
    create_reset_token,
    get_reset_token_by_hash,
    mark_token_used,
)
from app.modules.auth.schemas import ForgotPasswordResponse, TokenResponse
from app.modules.users.repository import (
    get_by_id_global,
    get_user_by_email,
    update_last_login,
    update_password,
)

logger = get_logger(__name__)

REFRESH_COOKIE_NAME = "refresh_token"


# ─── Redis key helpers ────────────────────────────────────────────────────────

def _refresh_redis_key(user_id: int, session_id: str) -> str:
    return f"refresh_token:{user_id}:{session_id}"


def _rate_limit_key(ip: str) -> str:
    return f"rate_limit:login:{ip}"


# ─── Rate limiting ────────────────────────────────────────────────────────────

def _check_rate_limit(redis_client: redis_lib.Redis, ip: str) -> None:
    try:
        count = redis_client.get(_rate_limit_key(ip))
        if count and int(count) >= settings.login_rate_limit_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Too many failed login attempts. "
                    f"Please wait {settings.login_rate_limit_window_minutes} minutes and try again."
                ),
            )
    except HTTPException:
        raise
    except Exception:
        logger.warning("Rate limit check skipped — Redis unavailable")


def _increment_rate_limit(redis_client: redis_lib.Redis, ip: str) -> None:
    try:
        key = _rate_limit_key(ip)
        pipe = redis_client.pipeline()
        pipe.incr(key)
        pipe.expire(key, settings.login_rate_limit_window_minutes * 60)
        pipe.execute()
    except Exception:
        logger.warning("Rate limit increment skipped — Redis unavailable")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _ensure_utc(dt: datetime) -> datetime:
    """Attach UTC timezone to naive datetimes returned by some DB drivers."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _set_refresh_cookie(response: Response, token_value: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token_value,
        httponly=True,
        max_age=settings.refresh_token_expire_days * 86400,
        samesite="lax",
        secure=settings.app_env == "production",
    )


def _build_access_payload(user_id: int, role: str, restaurant_id: int | None) -> dict:
    return {
        "sub": str(user_id),
        "role": role,
        "restaurant_id": restaurant_id,
    }


# ─── Auth operations ──────────────────────────────────────────────────────────

def login(
    db: Session,
    redis_client: redis_lib.Redis,
    response: Response,
    email: str,
    password: str,
    ip: str,
    user_agent: str,
) -> TokenResponse:
    _check_rate_limit(redis_client, ip)

    user = get_user_by_email(db, email)

    if not user or not verify_password(password, user.password_hash):
        _increment_rate_limit(redis_client, ip)
        write_audit_log(
            db,
            event_type="login_failed",
            user_id=user.id if user else None,
            ip_address=ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Contact your administrator.",
        )

    session_id = str(uuid.uuid4())
    access_token = create_access_token(
        _build_access_payload(user.id, user.role.value, user.restaurant_id)
    )
    refresh_token_value = create_refresh_token(user.id, session_id)

    try:
        redis_client.setex(
            _refresh_redis_key(user.id, session_id),
            settings.refresh_token_expire_days * 86400,
            "valid",
        )
        _set_refresh_cookie(response, refresh_token_value)
    except Exception:
        logger.warning("Refresh token session not stored — Redis unavailable")

    update_last_login(db, user)
    write_audit_log(
        db,
        event_type="login_success",
        user_id=user.id,
        ip_address=ip,
        user_agent=user_agent,
    )

    return TokenResponse(access_token=access_token)


def refresh(
    db: Session,
    redis_client: redis_lib.Redis,
    response: Response,
    refresh_token: str,
    ip: str,
    user_agent: str,
) -> TokenResponse:
    try:
        payload = decode_token(refresh_token)
    except JWTError:
        write_audit_log(
            db, event_type="refresh_token_failed", ip_address=ip, user_agent=user_agent
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type.",
        )

    user_id = int(payload["sub"])
    session_id: str = payload["session_id"]

    try:
        redis_key = _refresh_redis_key(user_id, session_id)
        if not redis_client.exists(redis_key):
            write_audit_log(
                db,
                event_type="refresh_token_failed",
                user_id=user_id,
                ip_address=ip,
                user_agent=user_agent,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired or revoked. Please log in again.",
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Session store unavailable. Please try again later.",
        )

    # Use global lookup — token refresh is an auth flow that must access
    # the user before tenant context can be verified.
    user = get_by_id_global(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
        )

    # Rotate: delete old session, create new one
    redis_client.delete(redis_key)
    new_session_id = str(uuid.uuid4())
    new_refresh_token = create_refresh_token(user.id, new_session_id)
    redis_client.setex(
        _refresh_redis_key(user.id, new_session_id),
        settings.refresh_token_expire_days * 86400,
        "valid",
    )
    _set_refresh_cookie(response, new_refresh_token)

    new_access_token = create_access_token(
        _build_access_payload(user.id, user.role.value, user.restaurant_id)
    )

    write_audit_log(
        db,
        event_type="refresh_token_issued",
        user_id=user.id,
        ip_address=ip,
        user_agent=user_agent,
    )

    return TokenResponse(access_token=new_access_token)


def logout(
    db: Session,
    redis_client: redis_lib.Redis,
    response: Response,
    refresh_token: str | None,
    user_id: int,
    ip: str,
    user_agent: str,
) -> dict:
    if refresh_token:
        try:
            payload = decode_token(refresh_token)
            session_id = payload.get("session_id")
            uid = int(payload.get("sub", 0))
            if session_id:
                redis_client.delete(_refresh_redis_key(uid, session_id))
        except Exception:
            pass  # Best-effort cleanup

    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        httponly=True,
        samesite="lax",
    )

    write_audit_log(
        db,
        event_type="logout",
        user_id=user_id,
        ip_address=ip,
        user_agent=user_agent,
    )

    return {"message": "Logged out successfully."}


def forgot_password(
    db: Session,
    email: str,
    ip: str,
    user_agent: str,
) -> ForgotPasswordResponse:
    safe_message = (
        "If that email address is registered, "
        "you will receive password reset instructions shortly."
    )

    user = get_user_by_email(db, email)

    # Always write audit log (with or without user) to avoid timing attacks
    write_audit_log(
        db,
        event_type="forgot_password_requested",
        user_id=user.id if user else None,
        ip_address=ip,
        user_agent=user_agent,
    )

    if not user:
        # Do not reveal whether the email exists
        return ForgotPasswordResponse(message=safe_message)

    raw_token = generate_secure_token()
    token_hash_value = hash_token(raw_token)
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.reset_token_expire_minutes)
    create_reset_token(db, user.id, token_hash_value, expires_at)

    if settings.app_env == "development":
        return ForgotPasswordResponse(message=safe_message, dev_reset_token=raw_token)

    return ForgotPasswordResponse(message=safe_message)


def reset_password(
    db: Session,
    token: str,
    new_password: str,
    ip: str,
    user_agent: str,
) -> dict:
    token_hash_value = hash_token(token)
    record = get_reset_token_by_hash(db, token_hash_value)

    _invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired reset token.",
    )

    if not record:
        raise _invalid

    if record.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset token has already been used.",
        )

    if datetime.now(UTC) > _ensure_utc(record.expires_at):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new password reset.",
        )

    user = get_user_by_id(db, record.user_id)
    if not user:
        raise _invalid

    update_password(db, user, hash_password(new_password))
    mark_token_used(db, record)

    write_audit_log(
        db,
        event_type="password_reset_success",
        user_id=user.id,
        ip_address=ip,
        user_agent=user_agent,
    )

    return {"message": "Password has been reset successfully. Please log in with your new password."}
