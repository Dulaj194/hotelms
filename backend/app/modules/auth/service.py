import uuid
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path

import redis as redis_lib
from fastapi import HTTPException, Response, UploadFile, status
from jose import JWTError
from sqlalchemy.exc import IntegrityError
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
from app.modules.restaurants.model import Restaurant
from app.modules.subscriptions import service as subscription_service
from app.modules.users.model import User, UserRole
from app.modules.users.repository import (
    get_by_id_global,
    get_user_by_email,
    update_last_login,
    update_password,
)

logger = get_logger(__name__)

REFRESH_COOKIE_NAME = "refresh_token"
_ALLOWED_LOGO_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_LOGO_EXT_MAP = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


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


def _build_access_payload(
    user_id: int,
    role: str,
    restaurant_id: int | None,
    must_change_password: bool,
) -> dict:
    return {
        "sub": str(user_id),
        "role": role,
        "restaurant_id": restaurant_id,
        "must_change_password": must_change_password,
    }


async def _save_logo_file(file: UploadFile) -> str:
    if file.content_type not in _ALLOWED_LOGO_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid logo file type. Allowed: jpg, png, webp, gif.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logo file is required.",
        )

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Logo exceeds the {settings.max_upload_size_mb} MB size limit.",
        )

    ext = _LOGO_EXT_MAP[file.content_type]
    filename = f"{uuid.uuid4().hex}{ext}"
    upload_path = Path(settings.upload_dir) / "logos"
    upload_path.mkdir(parents=True, exist_ok=True)
    (upload_path / filename).write_bytes(content)
    return f"/uploads/logos/{filename}"


async def register_restaurant(
    db: Session,
    *,
    restaurant_name: str,
    owner_full_name: str,
    owner_email: str,
    password: str,
    confirm_password: str,
    address: str,
    contact_number: str,
    opening_time: str,
    closing_time: str,
    logo: UploadFile,
) -> tuple[int, str]:
    if password != confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password and confirm password do not match.",
        )

    if get_user_by_email(db, owner_email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    existing_restaurant_email = (
        db.query(Restaurant)
        .filter(Restaurant.email == owner_email)
        .first()
    )
    if existing_restaurant_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Restaurant email already in use.",
        )

    logo_url = await _save_logo_file(logo)

    try:
        restaurant = Restaurant(
            name=restaurant_name,
            email=owner_email,
            phone=contact_number,
            address=address,
            opening_time=opening_time,
            closing_time=closing_time,
            logo_url=logo_url,
        )
        db.add(restaurant)
        db.flush()

        owner = User(
            full_name=owner_full_name,
            email=owner_email,
            password_hash=hash_password(password),
            role=UserRole.owner,
            restaurant_id=restaurant.id,
            is_active=True,
            must_change_password=False,
        )
        db.add(owner)

        subscription_service.assign_initial_trial_subscription(
            db,
            restaurant.id,
            commit=False,
        )

        db.commit()
        return restaurant.id, owner.email
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registration failed because the email already exists.",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Restaurant self-registration failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to complete registration at the moment.",
        ) from exc


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
        _build_access_payload(user.id, user.role.value, user.restaurant_id, user.must_change_password)
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

    return TokenResponse(access_token=access_token, must_change_password=user.must_change_password)


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
        _build_access_payload(user.id, user.role.value, user.restaurant_id, user.must_change_password)
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

    user = get_by_id_global(db, record.user_id)
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


def change_initial_password(
    db: Session,
    current_user,
    payload,
) -> dict:
    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="New password and confirm password do not match.",
        )

    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect.",
        )

    if verify_password(payload.new_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password.",
        )

    current_user.password_hash = hash_password(payload.new_password)
    current_user.must_change_password = False
    current_user.password_changed_at = datetime.now(UTC)
    db.commit()

    write_audit_log(
        db,
        event_type="initial_password_changed",
        user_id=current_user.id,
    )

    return {"message": "Password changed successfully."}
