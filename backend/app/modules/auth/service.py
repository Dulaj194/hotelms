import uuid
import json
from datetime import UTC, datetime, timedelta, timezone

import redis as redis_lib
from fastapi import HTTPException, Response, UploadFile, status
from jose import JWTError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.file_storage import delete_uploaded_file, save_upload_file
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
from app.modules.auth import registration_repository
from app.modules.auth.login_scope import (
    GENERAL_LOGIN_SCOPE,
    RESTAURANT_ADMIN_LOGIN_SCOPE,
    STAFF_LOGIN_SCOPE,
    SUPER_ADMIN_LOGIN_SCOPE,
    is_login_scope_allowed,
)
from app.modules.auth.schemas import (
    ForgotPasswordResponse,
    TenantContextResponse,
    TenantDataCountsResponse,
    TokenResponse,
    UserFeatureFlagResponse,
    UserMeResponse,
    UserModuleAccessResponse,
)
from app.modules.access import catalog as access_catalog
from app.modules.realtime import service as realtime_service
from app.modules.restaurants.model import RegistrationStatus
from app.modules.subscriptions import service as subscription_service
from app.modules.users.model import UserRole
from app.modules.users.repository import (
    get_by_id_global,
    get_user_by_email,
    update_last_login,
    update_password,
)

logger = get_logger(__name__)

REFRESH_COOKIE_NAME = "refresh_token"
GENERIC_AUTH_ERROR_DETAIL = "Invalid email or password."
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


def _registration_idempotency_key(owner_email: str, idempotency_key: str) -> str:
    normalized_email = owner_email.strip().lower()
    normalized_key = idempotency_key.strip()
    return f"idempotency:register:{normalized_email}:{normalized_key}"


def _normalize_login_email(email: str) -> str:
    return email.strip().lower()


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


def _session_timeout_seconds() -> tuple[int, int]:
    idle_seconds = settings.session_idle_timeout_minutes * 60
    absolute_seconds = settings.session_absolute_timeout_hours * 3600
    return idle_seconds, absolute_seconds


def _build_session_state(*, created_at: int, last_seen: int) -> str:
    return json.dumps({"created_at": created_at, "last_seen": last_seen})


def _parse_session_state(raw: str | bytes | None) -> tuple[int, int] | None:
    if raw is None:
        return None

    decoded = raw.decode() if isinstance(raw, bytes) else raw
    if decoded == "valid":
        now_ts = int(datetime.now(UTC).timestamp())
        return now_ts, now_ts

    try:
        payload = json.loads(decoded)
        created_at = int(payload["created_at"])
        last_seen = int(payload["last_seen"])
        return created_at, last_seen
    except Exception:
        return None


def _session_is_expired(created_at: int, last_seen: int) -> bool:
    now_ts = int(datetime.now(UTC).timestamp())
    idle_seconds, absolute_seconds = _session_timeout_seconds()
    idle_expired = (now_ts - last_seen) > idle_seconds
    absolute_expired = (now_ts - created_at) > absolute_seconds
    return idle_expired or absolute_expired


def _revoke_presented_refresh_session(
    redis_client: redis_lib.Redis,
    refresh_token: str | None,
) -> None:
    if not refresh_token:
        return
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            return
        session_id = payload.get("session_id")
        user_id = int(payload.get("sub", 0))
        if session_id and user_id:
            redis_client.delete(_refresh_redis_key(user_id, session_id))
    except Exception:
        return


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


def _get_restaurant_name(db: Session, restaurant_id: int) -> str | None:
    from app.modules.restaurants.model import Restaurant

    return db.query(Restaurant.name).filter(Restaurant.id == restaurant_id).scalar()


def _get_restaurant_for_user(db: Session, restaurant_id: int | None):
    if restaurant_id is None:
        return None

    from app.modules.restaurants.model import Restaurant

    return db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()


def _empty_feature_flag_snapshot() -> UserFeatureFlagResponse:
    return UserFeatureFlagResponse()


def _empty_module_access_snapshot() -> UserModuleAccessResponse:
    return UserModuleAccessResponse()


def _assert_role_feature_access(user, restaurant) -> None:
    role_obj = getattr(user, "role", None)
    role = role_obj.value if hasattr(role_obj, "value") else str(role_obj)

    required_feature_by_role = {
        "steward": "steward",
        "housekeeper": "housekeeping",
        "cashier": "cashier",
        "accountant": "accountant",
    }
    required_feature = required_feature_by_role.get(role)
    if required_feature is None:
        return

    feature_flags = access_catalog.build_feature_flag_snapshot(restaurant)
    if feature_flags.get(required_feature, True):
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"The '{required_feature}' workflow is disabled for this restaurant.",
    )


def _ensure_restaurant_login_allowed(
    db: Session,
    user,
    restaurant_id: int | None,
) -> None:
    if restaurant_id is None:
        return

    restaurant = _get_restaurant_for_user(db, restaurant_id)
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


def _count_model_rows(db: Session, model, restaurant_id: int) -> int:
    from sqlalchemy import func

    count_value = db.query(func.count(model.id)).filter(model.restaurant_id == restaurant_id).scalar()
    return int(count_value or 0)


def get_tenant_context_snapshot(db: Session, current_user) -> TenantContextResponse:
    """Return authenticated tenant context + tenant-scoped catalog counts.

    This makes tenant isolation explicit in the UI and helps operators verify
    whether data belongs to the currently signed-in restaurant account.
    """
    if current_user.restaurant_id is None:
        return TenantContextResponse(
            user_id=current_user.id,
            email=current_user.email,
            role=current_user.role.value,
            restaurant_id=None,
            restaurant_name=None,
            counts=TenantDataCountsResponse(),
            note="This account has no restaurant context. Tenant-scoped data is not available.",
        )

    from app.modules.categories.model import Category
    from app.modules.items.model import Item
    from app.modules.menus.model import Menu
    from app.modules.subcategories.model import Subcategory

    restaurant_id = int(current_user.restaurant_id)
    return TenantContextResponse(
        user_id=current_user.id,
        email=current_user.email,
        role=current_user.role.value,
        restaurant_id=restaurant_id,
        restaurant_name=_get_restaurant_name(db, restaurant_id),
        counts=TenantDataCountsResponse(
            menus=_count_model_rows(db, Menu, restaurant_id),
            categories=_count_model_rows(db, Category, restaurant_id),
            subcategories=_count_model_rows(db, Subcategory, restaurant_id),
            items=_count_model_rows(db, Item, restaurant_id),
        ),
    )


def get_user_me_snapshot(db: Session, current_user) -> UserMeResponse:
    package_id: int | None = None
    package_name: str | None = None
    package_code: str | None = None
    subscription_status: str | None = None
    privileges: list[str] = []
    feature_flags = _empty_feature_flag_snapshot()
    module_access = _empty_module_access_snapshot()

    if current_user.restaurant_id is not None:
        access_summary = subscription_service.get_package_access_summary(
            db,
            current_user.restaurant_id,
        )
        package_id = access_summary.package_id
        package_name = access_summary.package_name
        package_code = access_summary.package_code
        subscription_status = access_summary.status
        privileges = [item.code for item in access_summary.privileges]
        feature_flags = UserFeatureFlagResponse.model_validate(
            {
                item.key: item.enabled
                for item in access_summary.feature_flags
            }
        )
        module_access = UserModuleAccessResponse.model_validate(
            {
                item.key: item.is_enabled
                for item in access_summary.module_access
            }
        )

    return UserMeResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role.value,
        restaurant_id=current_user.restaurant_id,
        is_active=current_user.is_active,
        must_change_password=current_user.must_change_password,
        package_id=package_id,
        package_name=package_name,
        package_code=package_code,
        subscription_status=subscription_status,
        privileges=privileges,
        super_admin_scopes=current_user.super_admin_scopes,
        feature_flags=feature_flags,
        module_access=module_access,
    )


async def _save_logo_file(file: UploadFile) -> str:
    return await save_upload_file(
        file=file,
        upload_root=settings.upload_dir,
        subdir="logos",
        allowed_content_types=_ALLOWED_LOGO_CONTENT_TYPES,
        ext_map=_LOGO_EXT_MAP,
        max_size_mb=settings.max_upload_size_mb,
    )


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
    correlation_id: str | None,
    ip: str,
    user_agent: str,
) -> tuple[int, str]:
    if password != confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password and confirm password do not match.",
        )

    normalized_email = owner_email.strip().lower()

    if get_user_by_email(db, normalized_email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Existing trial data is unchanged.",
        )

    existing_restaurant_email = registration_repository.get_restaurant_by_email(db, normalized_email)
    if existing_restaurant_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Restaurant email already in use. Existing trial data is unchanged.",
        )

    logger.info(
        "event=registration_attempt correlation_id=%s owner_email=%s",
        correlation_id,
        normalized_email,
    )
    write_audit_log(
        db,
        event_type="restaurant_registration_attempt",
        ip_address=ip,
        user_agent=user_agent,
        metadata={"correlation_id": correlation_id, "owner_email": normalized_email},
    )

    logo_url = await _save_logo_file(logo)

    try:
        restaurant = registration_repository.create_restaurant(
            db,
            name=restaurant_name.strip(),
            email=normalized_email,
            contact_number=contact_number,
            address=address.strip(),
            opening_time=opening_time,
            closing_time=closing_time,
            logo_url=logo_url,
        )

        owner = registration_repository.create_linked_admin(
            db,
            full_name=owner_full_name.strip(),
            email=normalized_email,
            password_hash=hash_password(password),
            restaurant_id=restaurant.id,
        )

        db.commit()
        audit_log = write_audit_log(
            db,
            event_type="restaurant_registration_success",
            user_id=owner.id,
            restaurant_id=restaurant.id,
            ip_address=ip,
            user_agent=user_agent,
            metadata={"correlation_id": correlation_id, "restaurant_id": restaurant.id},
        )
        if audit_log is not None:
            realtime_service.publish_super_admin_audit_notification(
                audit_log=audit_log,
                restaurant_id=restaurant.id,
            )
        logger.info(
            "event=registration_success correlation_id=%s restaurant_id=%s owner_email=%s",
            correlation_id,
            restaurant.id,
            normalized_email,
        )
        return restaurant.id, owner.email
    except HTTPException:
        db.rollback()
        delete_uploaded_file(upload_root=settings.upload_dir, public_path=logo_url)
        raise
    except IntegrityError as exc:
        db.rollback()
        delete_uploaded_file(upload_root=settings.upload_dir, public_path=logo_url)
        write_audit_log(
            db,
            event_type="restaurant_registration_failed",
            ip_address=ip,
            user_agent=user_agent,
            metadata={"correlation_id": correlation_id, "reason": "integrity_error"},
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registration could not be completed with the provided details.",
        ) from exc
    except Exception as exc:
        db.rollback()
        delete_uploaded_file(upload_root=settings.upload_dir, public_path=logo_url)
        write_audit_log(
            db,
            event_type="restaurant_registration_failed",
            ip_address=ip,
            user_agent=user_agent,
            metadata={"correlation_id": correlation_id, "reason": "unexpected_error"},
        )
        logger.exception("Restaurant self-registration failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to complete registration at the moment.",
        ) from exc


async def register_restaurant_idempotent(
    db: Session,
    redis_client: redis_lib.Redis,
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
    idempotency_key: str,
    correlation_id: str | None,
    ip: str,
    user_agent: str,
) -> tuple[int, str]:
    redis_key = _registration_idempotency_key(owner_email, idempotency_key)
    claimed = False

    try:
        existing = redis_client.get(redis_key)
        if existing:
            payload = json.loads(existing)
            if payload.get("state") == "success":
                return int(payload["restaurant_id"]), str(payload["owner_email"])
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Registration request is already being processed.",
            )

        claimed = bool(
            redis_client.set(
                redis_key,
                json.dumps({"state": "processing"}),
                ex=600,
                nx=True,
            )
        )
        if not claimed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Duplicate registration request detected. Please retry shortly.",
            )
    except HTTPException:
        raise
    except Exception:
        logger.warning("Registration idempotency skipped — Redis unavailable")

    restaurant_id, saved_owner_email = await register_restaurant(
        db,
        restaurant_name=restaurant_name,
        owner_full_name=owner_full_name,
        owner_email=owner_email,
        password=password,
        confirm_password=confirm_password,
        address=address,
        contact_number=contact_number,
        opening_time=opening_time,
        closing_time=closing_time,
        logo=logo,
        correlation_id=correlation_id,
        ip=ip,
        user_agent=user_agent,
    )

    if claimed:
        try:
            redis_client.set(
                redis_key,
                json.dumps(
                    {
                        "state": "success",
                        "restaurant_id": restaurant_id,
                        "owner_email": saved_owner_email,
                    }
                ),
                ex=3600,
            )
        except Exception:
            logger.warning("Unable to persist idempotent registration result")

    return restaurant_id, saved_owner_email


# ─── Auth operations ──────────────────────────────────────────────────────────

def login(
    db: Session,
    redis_client: redis_lib.Redis,
    response: Response,
    email: str,
    password: str,
    ip: str,
    user_agent: str,
    existing_refresh_token: str | None = None,
    allowed_roles: frozenset[UserRole] | set[UserRole] | None = GENERAL_LOGIN_SCOPE.allowed_roles,
    require_restaurant_context: bool = GENERAL_LOGIN_SCOPE.require_restaurant_context,
    scope_key: str = GENERAL_LOGIN_SCOPE.scope_key,
) -> TokenResponse:
    _check_rate_limit(redis_client, ip)

    normalized_email = _normalize_login_email(email)

    user = get_user_by_email(db, normalized_email)

    if not user or not verify_password(password, user.password_hash):
        _increment_rate_limit(redis_client, ip)
        write_audit_log(
            db,
            event_type="login_failed",
            user_id=user.id if user else None,
            ip_address=ip,
            user_agent=user_agent,
            metadata={"reason": "invalid_credentials", "login_scope": scope_key},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=GENERIC_AUTH_ERROR_DETAIL,
        )

    if not is_login_scope_allowed(
        user_role=user.role,
        user_restaurant_id=user.restaurant_id,
        allowed_roles=allowed_roles,
        require_restaurant_context=require_restaurant_context,
    ):
        allowed_role_values = sorted(role.value for role in allowed_roles) if allowed_roles else None
        write_audit_log(
            db,
            event_type="login_failed",
            user_id=user.id,
            ip_address=ip,
            user_agent=user_agent,
            metadata={
                "reason": "login_scope_mismatch",
                "login_scope": scope_key,
                "user_role": user.role.value,
                "has_restaurant_context": user.restaurant_id is not None,
                "required_roles": allowed_role_values,
                "require_restaurant_context": require_restaurant_context,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=GENERIC_AUTH_ERROR_DETAIL,
        )

    _ensure_restaurant_login_allowed(db, user, user.restaurant_id)

    if not user.is_active:
        write_audit_log(
            db,
            event_type="login_failed",
            user_id=user.id,
            ip_address=ip,
            user_agent=user_agent,
            metadata={"reason": "inactive_account", "login_scope": scope_key},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=GENERIC_AUTH_ERROR_DETAIL,
        )

    _revoke_presented_refresh_session(redis_client, existing_refresh_token)

    session_id = str(uuid.uuid4())
    access_token = create_access_token(
        _build_access_payload(user.id, user.role.value, user.restaurant_id, user.must_change_password)
    )
    refresh_token_value = create_refresh_token(user.id, session_id)

    try:
        now_ts = int(datetime.now(UTC).timestamp())
        redis_client.setex(
            _refresh_redis_key(user.id, session_id),
            settings.refresh_token_expire_days * 86400,
            _build_session_state(created_at=now_ts, last_seen=now_ts),
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
        metadata={
            "login_scope": scope_key,
            "user_role": user.role.value,
            "restaurant_id": user.restaurant_id,
        },
    )

    return TokenResponse(access_token=access_token, must_change_password=user.must_change_password)


def login_restaurant_admin(
    db: Session,
    redis_client: redis_lib.Redis,
    response: Response,
    email: str,
    password: str,
    ip: str,
    user_agent: str,
    existing_refresh_token: str | None = None,
) -> TokenResponse:
    return login(
        db,
        redis_client,
        response,
        email,
        password,
        ip,
        user_agent,
        existing_refresh_token,
        allowed_roles=RESTAURANT_ADMIN_LOGIN_SCOPE.allowed_roles,
        require_restaurant_context=RESTAURANT_ADMIN_LOGIN_SCOPE.require_restaurant_context,
        scope_key=RESTAURANT_ADMIN_LOGIN_SCOPE.scope_key,
    )


def login_staff(
    db: Session,
    redis_client: redis_lib.Redis,
    response: Response,
    email: str,
    password: str,
    ip: str,
    user_agent: str,
    existing_refresh_token: str | None = None,
) -> TokenResponse:
    return login(
        db,
        redis_client,
        response,
        email,
        password,
        ip,
        user_agent,
        existing_refresh_token,
        allowed_roles=STAFF_LOGIN_SCOPE.allowed_roles,
        require_restaurant_context=STAFF_LOGIN_SCOPE.require_restaurant_context,
        scope_key=STAFF_LOGIN_SCOPE.scope_key,
    )


def login_super_admin(
    db: Session,
    redis_client: redis_lib.Redis,
    response: Response,
    email: str,
    password: str,
    ip: str,
    user_agent: str,
    existing_refresh_token: str | None = None,
) -> TokenResponse:
    return login(
        db,
        redis_client,
        response,
        email,
        password,
        ip,
        user_agent,
        existing_refresh_token,
        allowed_roles=SUPER_ADMIN_LOGIN_SCOPE.allowed_roles,
        require_restaurant_context=SUPER_ADMIN_LOGIN_SCOPE.require_restaurant_context,
        scope_key=SUPER_ADMIN_LOGIN_SCOPE.scope_key,
    )


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
        raw_session_state = redis_client.get(redis_key)
        session_state = _parse_session_state(raw_session_state)
        if session_state is None:
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

        created_at, last_seen = session_state
        if _session_is_expired(created_at, last_seen):
            redis_client.delete(redis_key)
            write_audit_log(
                db,
                event_type="refresh_token_failed",
                user_id=user_id,
                ip_address=ip,
                user_agent=user_agent,
                metadata={"reason": "session_timeout"},
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

    _ensure_restaurant_login_allowed(db, user, user.restaurant_id)

    # Rotate: delete old session, create new one
    redis_client.delete(redis_key)
    new_session_id = str(uuid.uuid4())
    new_refresh_token = create_refresh_token(user.id, new_session_id)
    now_ts = int(datetime.now(UTC).timestamp())
    redis_client.setex(
        _refresh_redis_key(user.id, new_session_id),
        settings.refresh_token_expire_days * 86400,
        _build_session_state(created_at=created_at, last_seen=now_ts),
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
