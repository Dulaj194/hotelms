import uuid
import base64
import json
from datetime import UTC, datetime, timedelta
import binascii
from pathlib import Path
import secrets
import string
from urllib import error as urllib_error
from urllib import request as urllib_request

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.notifications import (
    send_onboarding_email,
    send_registration_approved_email,
    send_registration_approved_sms,
    send_temporary_password_reset_email,
)
from app.core.security import (
    decrypt_secret_value,
    encrypt_secret_value,
    generate_secure_token,
    hash_password,
    hash_token,
)
from app.modules.access import catalog as access_catalog
from app.modules.access import role_catalog
from app.modules.audit_logs.service import write_audit_log
from app.modules.restaurants.integration_service import DEFAULT_WEBHOOK_SECRET_HEADER_NAME
from app.modules.realtime import service as realtime_service
from app.modules.reference_data import service as reference_data_service
from app.modules.restaurants import repository
from app.modules.subscriptions import repository as subscription_repository
from app.modules.subscriptions import service as subscription_service
from app.modules.subscriptions.model import RestaurantSubscription, SubscriptionStatus
from app.modules.restaurants.model import (
    RegistrationStatus,
    RestaurantPasswordRevealToken,
    WebhookHealthStatus,
)
from app.modules.users.model import UserRole
from app.modules.users.repository import create_staff, get_by_id, get_user_by_email, list_by_restaurant
from app.modules.users.schemas import StaffCreateRequest
from app.modules.restaurants.schemas import (
    PendingRestaurantRegistrationListResponse,
    RestaurantApiKeyProvisionResponse,
    RestaurantApiKeySummaryResponse,
    RestaurantAdminUpdateRequest,
    RestaurantCreateRequest,
    RestaurantDeleteResponse,
    RestaurantIntegrationResponse,
    RestaurantIntegrationSettingsResponse,
    RestaurantIntegrationUpdateRequest,
    RestaurantOverviewListResponse,
    RestaurantRegistrationHistoryListResponse,
    RestaurantRegistrationBulkReviewRequest,
    RestaurantRegistrationBulkReviewResponse,
    RestaurantRegistrationBulkReviewResultItem,
    RestaurantLogoUploadResponse,
    RestaurantMeResponse,
    RestaurantRegistrationReviewRequest,
    RestaurantRegistrationReviewResponse,
    RestaurantRegistrationSummaryResponse,
    RestaurantStaffPasswordRevealResponse,
    RestaurantStaffPasswordResetRequest,
    RestaurantStaffPasswordResetResponse,
    RestaurantSubscriptionSnapshotResponse,
    RestaurantUpdateRequest,
    RestaurantWebhookSecretSummaryResponse,
    RestaurantWebhookHealthRefreshResponse,
)

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_EXT_MAP = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
_RESETTABLE_HOTEL_STAFF_ROLES = role_catalog.RESETTABLE_RESTAURANT_STAFF_ROLES
_STAFF_PASSWORD_REVEAL_TTL_MINUTES = 15
_STAFF_PASSWORD_REVEAL_INVALID_DETAIL = "Temporary password reveal token is invalid or expired."


def _normalize_reason(reason: str | None, *, default_reason: str) -> str:
    if reason is None:
        return default_reason
    trimmed = reason.strip()
    return trimmed if trimmed else default_reason


def _encode_pagination_cursor(timestamp: datetime, entity_id: int) -> str:
    payload = f"{timestamp.isoformat()}|{entity_id}"
    return base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii")


def _decode_pagination_cursor(cursor: str) -> tuple[datetime, int]:
    try:
        decoded = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
        raw_timestamp, raw_id = decoded.split("|", 1)
        timestamp = datetime.fromisoformat(raw_timestamp)
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=UTC)
        return timestamp, int(raw_id)
    except (ValueError, TypeError, binascii.Error):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid pagination cursor.",
        )


def _build_change_delta(
    before_state: dict[str, object],
    after_state: dict[str, object],
) -> dict[str, dict[str, object]]:
    delta: dict[str, dict[str, object]] = {}
    for key in sorted(set(before_state.keys()) | set(after_state.keys())):
        before_value = before_state.get(key)
        after_value = after_state.get(key)
        if before_value != after_value:
            delta[key] = {
                "before": before_value,
                "after": after_value,
            }
    return delta


def _restaurant_lifecycle_snapshot(restaurant) -> dict[str, object]:
    banner_urls = _parse_json_document(restaurant.public_menu_banner_urls_json, [])
    if not isinstance(banner_urls, list):
        banner_urls = []
    return {
        "restaurant_id": restaurant.id,
        "name": restaurant.name,
        "email": restaurant.email,
        "phone": restaurant.phone,
        "address": restaurant.address,
        "country": restaurant.country,
        "country_id": restaurant.country_id,
        "currency": restaurant.currency,
        "currency_id": restaurant.currency_id,
        "billing_email": restaurant.billing_email,
        "public_menu_banner_urls": [str(url) for url in banner_urls if url],
        "opening_time": restaurant.opening_time,
        "closing_time": restaurant.closing_time,
        "is_active": restaurant.is_active,
        "registration_status": restaurant.registration_status.value,
        "registration_review_notes": restaurant.registration_review_notes,
        "feature_flags": {
            "steward": bool(restaurant.enable_steward),
            "housekeeping": bool(restaurant.enable_housekeeping),
            "kds": bool(restaurant.enable_kds),
            "reports": bool(restaurant.enable_reports),
            "accountant": bool(restaurant.enable_accountant),
            "cashier": bool(restaurant.enable_cashier),
        },
    }


def _write_restaurant_mutation_audit(
    db: Session,
    *,
    event_type: str,
    current_user_id: int,
    restaurant_id: int,
    reason: str | None,
    default_reason: str,
    before_state: dict[str, object],
    after_state: dict[str, object],
    extra_metadata: dict[str, object] | None = None,
) -> None:
    delta = _build_change_delta(before_state, after_state)
    metadata = {
        "restaurant_id": restaurant_id,
        "reason": _normalize_reason(reason, default_reason=default_reason),
        "before": before_state,
        "after": after_state,
        "delta": delta,
        "delta_field_count": len(delta),
    }
    if extra_metadata:
        metadata.update(extra_metadata)

    audit_log = write_audit_log(
        db,
        event_type=event_type,
        user_id=current_user_id,
        restaurant_id=restaurant_id,
        metadata=metadata,
    )
    if audit_log is not None:
        realtime_service.publish_super_admin_audit_notification(
            audit_log=audit_log,
            restaurant_id=restaurant_id,
        )


def _send_registration_approval_notifications(
    db: Session,
    *,
    restaurant,
    review_notes: str | None,
) -> dict[str, object]:
    owner = repository.get_owner_user(db, restaurant.id)
    recipient_email = (owner.email if owner else restaurant.email) or ""
    recipient_name = (owner.full_name if owner else restaurant.name) or restaurant.name
    recipient_phone = (
        owner.phone
        if owner and owner.phone
        else (restaurant.phone or "")
    )

    email_sent = False
    sms_sent = False

    if recipient_email:
        email_sent = send_registration_approved_email(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            restaurant_name=restaurant.name,
            review_notes=review_notes,
        )

    if recipient_phone:
        sms_sent = send_registration_approved_sms(
            recipient_phone=recipient_phone,
            restaurant_name=restaurant.name,
        )

    return {
        "notification_email": recipient_email or None,
        "notification_phone": recipient_phone or None,
        "notification_email_sent": email_sent,
        "notification_sms_sent": sms_sent,
    }


def _effective_billing_email(
    *,
    primary_email: str | None,
    billing_email: str | None,
) -> str | None:
    return billing_email or primary_email or None


def _apply_billing_email_defaults(
    update_data: dict,
    *,
    existing_primary_email: str | None = None,
    existing_billing_email: str | None = None,
) -> dict:
    normalized = dict(update_data)
    next_primary_email = (
        str(normalized.get("email")) if normalized.get("email") else None
        if "email" in normalized
        else existing_primary_email
    )

    if "billing_email" in normalized:
        explicit_billing_email = (
            str(normalized.get("billing_email")) if normalized.get("billing_email") else None
        )
        normalized["billing_email"] = _effective_billing_email(
            primary_email=next_primary_email,
            billing_email=explicit_billing_email,
        )
        return normalized

    if existing_primary_email is None and existing_billing_email is None:
        if next_primary_email:
            normalized["billing_email"] = next_primary_email
        return normalized

    if "email" in normalized:
        current_effective_billing = _effective_billing_email(
            primary_email=existing_primary_email,
            billing_email=existing_billing_email,
        )
        if current_effective_billing == existing_primary_email:
            normalized["billing_email"] = next_primary_email

    return normalized


def _build_profile_update_data(
    db: Session,
    payload: RestaurantUpdateRequest | RestaurantCreateRequest | RestaurantAdminUpdateRequest,
    *,
    existing_primary_email: str | None = None,
    existing_billing_email: str | None = None,
) -> dict:
    normalized_payload = _with_normalized_reference_fields(db, payload)
    update_data = normalized_payload.model_dump(exclude_unset=True)

    if "public_menu_banner_urls" in update_data:
        banner_urls = update_data.pop("public_menu_banner_urls")
        update_data["public_menu_banner_urls_json"] = (
            json.dumps(banner_urls or [], ensure_ascii=True)
            if banner_urls is not None
            else None
        )

    feature_flag_updates = update_data.pop("feature_flags", None)
    if isinstance(feature_flag_updates, dict):
        update_data.update(access_catalog.flatten_feature_flag_updates(feature_flag_updates))
    return _apply_billing_email_defaults(
        update_data,
        existing_primary_email=existing_primary_email,
        existing_billing_email=existing_billing_email,
    )


def _serialize_restaurant(restaurant) -> RestaurantMeResponse:
    response = RestaurantMeResponse.model_validate(restaurant)
    return response.model_copy(
        update={
            "feature_flags": access_catalog.build_feature_flag_snapshot(restaurant),
            "integration": _build_integration_response(restaurant),
            "billing_email": _effective_billing_email(
                primary_email=response.email,
                billing_email=response.billing_email,
            )
        }
    )


def _mask_api_key(prefix: str | None, last4: str | None) -> str | None:
    if not prefix or not last4:
        return None
    return f"{prefix}...{last4}"


def _build_api_key_summary(restaurant) -> RestaurantApiKeySummaryResponse:
    has_key = bool(
        restaurant.integration_api_key_hash
        and restaurant.integration_api_key_prefix
        and restaurant.integration_api_key_last4
    )
    return RestaurantApiKeySummaryResponse(
        has_key=has_key,
        is_active=bool(has_key and restaurant.integration_api_key_active),
        masked_key=_mask_api_key(
            restaurant.integration_api_key_prefix,
            restaurant.integration_api_key_last4,
        ),
        rotated_at=restaurant.integration_api_key_rotated_at,
    )


def _build_webhook_secret_summary(restaurant) -> RestaurantWebhookSecretSummaryResponse:
    return RestaurantWebhookSecretSummaryResponse(
        has_secret=bool(restaurant.integration_webhook_secret_ciphertext),
        header_name=restaurant.integration_webhook_secret_header_name,
        masked_value=(
            f"****{restaurant.integration_webhook_secret_last4}"
            if restaurant.integration_webhook_secret_last4
            else None
        ),
        rotated_at=restaurant.integration_webhook_secret_rotated_at,
    )


def _build_integration_settings(restaurant) -> RestaurantIntegrationSettingsResponse:
    return RestaurantIntegrationSettingsResponse(
        public_ordering_enabled=restaurant.integration_public_ordering_enabled,
        webhook_url=restaurant.integration_webhook_url,
        webhook_secret_header_name=restaurant.integration_webhook_secret_header_name,
        webhook_status=restaurant.integration_webhook_status.value,
        webhook_last_checked_at=restaurant.integration_webhook_last_checked_at,
        webhook_last_error=restaurant.integration_webhook_last_error,
    )


def _build_integration_response(restaurant) -> RestaurantIntegrationResponse:
    return RestaurantIntegrationResponse(
        api_key=_build_api_key_summary(restaurant),
        settings=_build_integration_settings(restaurant),
        webhook_secret=_build_webhook_secret_summary(restaurant),
    )


def _generate_restaurant_api_key() -> str:
    return f"hmsrk_{secrets.token_hex(24)}"


def _probe_webhook_url(
    webhook_url: str,
    timeout_seconds: float = 5.0,
) -> tuple[bool, str | None]:
    last_error: str | None = None
    for method in ("HEAD", "GET"):
        try:
            request = urllib_request.Request(webhook_url, method=method)
            with urllib_request.urlopen(request, timeout=timeout_seconds) as response:
                status_code = getattr(response, "status", 200)
                if 200 <= status_code < 400:
                    return True, None
                return False, f"Webhook returned HTTP {status_code}."
        except urllib_error.HTTPError as exc:
            if exc.code == 405 and method == "HEAD":
                continue
            last_error = f"Webhook returned HTTP {exc.code}."
        except Exception as exc:  # pragma: no cover - depends on runtime network access
            last_error = str(exc)
    return False, last_error or "Unable to reach the webhook endpoint."


def get_my_restaurant(db: Session, restaurant_id: int) -> RestaurantMeResponse:
    """Return the authenticated tenant's restaurant profile.

    restaurant_id must come from the authenticated user context, never from a
    client-supplied value.
    """
    restaurant = repository.get_by_id(db, restaurant_id)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    return _serialize_restaurant(restaurant)


def update_my_restaurant(
    db: Session,
    restaurant_id: int,
    payload: RestaurantUpdateRequest,
) -> RestaurantMeResponse:
    """Update the authenticated tenant's restaurant profile."""
    current_restaurant = repository.get_by_id(db, restaurant_id)
    if current_restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    update_data = _build_profile_update_data(
        db,
        payload,
        existing_primary_email=current_restaurant.email,
        existing_billing_email=current_restaurant.billing_email,
    )
    restaurant = repository.update_profile(db, restaurant_id, update_data)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    return _serialize_restaurant(restaurant)


async def upload_logo(
    db: Session,
    restaurant_id: int,
    file: UploadFile,
    current_user_id: int,
) -> RestaurantLogoUploadResponse:
    """Validate, save, and register a restaurant logo file.

    Security guarantees:
    - Content-type validated against an explicit allowlist.
    - Extension derived from content-type, NEVER from original filename.
    - UUID-based filename prevents directory traversal.
    - File size validated after read (files are <5 MB max).
    """
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{file.content_type}'. Allowed: jpg, jpeg, png, webp, gif.",
        )

    content = await file.read()

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {settings.max_upload_size_mb} MB size limit.",
        )

    ext = _EXT_MAP[file.content_type]  # type: ignore[index]
    filename = f"{uuid.uuid4().hex}{ext}"

    upload_path = Path(settings.upload_dir) / "logos"
    upload_path.mkdir(parents=True, exist_ok=True)
    (upload_path / filename).write_bytes(content)

    logo_url = f"/uploads/logos/{filename}"
    restaurant = repository.update_logo(db, restaurant_id, logo_url)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )

    write_audit_log(db, event_type="restaurant_logo_uploaded", user_id=current_user_id)

    return RestaurantLogoUploadResponse(logo_url=logo_url)


def get_restaurant_for_super_admin(
    db: Session, restaurant_id: int
) -> RestaurantMeResponse:
    """Fetch any restaurant by ID. Restricted to super_admin use only."""
    restaurant = repository.get_by_id_for_super_admin(db, restaurant_id)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    return _serialize_restaurant(restaurant)


def find_restaurant_by_api_key(db: Session, api_key: str):
    return repository.get_by_active_api_key_hash(db, hash_token(api_key))


def list_all_restaurants(db: Session) -> list[RestaurantMeResponse]:
    """List all restaurants. Restricted to super_admin use only."""
    restaurants = repository.list_all_for_super_admin(db)
    return [_serialize_restaurant(r) for r in restaurants]


def _build_subscription_snapshot(
    restaurant_id: int,
    subscription: RestaurantSubscription | None,
) -> RestaurantSubscriptionSnapshotResponse:
    if subscription is None:
        return RestaurantSubscriptionSnapshotResponse(
            restaurant_id=restaurant_id,
            status="none",
            is_trial=False,
            is_active=False,
            is_expired=False,
            package_id=None,
            package_name=None,
            package_code=None,
            started_at=None,
            expires_at=None,
        )

    effective_expires_at = (
        subscription.trial_expires_at if subscription.is_trial else subscription.expires_at
    )
    status_value = subscription.status.value
    if (
        status_value in {SubscriptionStatus.active.value, SubscriptionStatus.trial.value}
        and effective_expires_at is not None
        and effective_expires_at <= datetime.utcnow()
    ):
        status_value = SubscriptionStatus.expired.value

    return RestaurantSubscriptionSnapshotResponse(
        restaurant_id=restaurant_id,
        status=status_value,
        is_trial=bool(subscription.is_trial),
        is_active=status_value in {SubscriptionStatus.active.value, SubscriptionStatus.trial.value},
        is_expired=status_value == SubscriptionStatus.expired.value,
        package_id=subscription.package_id,
        package_name=subscription.package.name if subscription.package else None,
        package_code=subscription.package.code if subscription.package else None,
        started_at=subscription.started_at,
        expires_at=effective_expires_at,
    )


def list_restaurants_overview(db: Session) -> RestaurantOverviewListResponse:
    """List restaurants with latest subscription snapshots in a single backend call."""
    restaurants = repository.list_all_for_super_admin(db)
    restaurant_ids = [restaurant.id for restaurant in restaurants]
    latest_subscriptions = subscription_repository.list_latest_subscriptions_by_restaurant_ids(
        db,
        restaurant_ids,
    )
    subscription_by_restaurant_id = {
        subscription.restaurant_id: subscription for subscription in latest_subscriptions
    }

    return RestaurantOverviewListResponse(
        items=[_serialize_restaurant(restaurant) for restaurant in restaurants],
        subscriptions=[
            _build_subscription_snapshot(
                restaurant.id,
                subscription_by_restaurant_id.get(restaurant.id),
            )
            for restaurant in restaurants
        ],
    )


def list_pending_restaurant_registrations(
    db: Session,
    *,
    limit: int = 100,
    cursor: str | None = None,
    sort_order: str = "oldest",
) -> PendingRestaurantRegistrationListResponse:
    cursor_created_at: datetime | None = None
    cursor_id: int | None = None
    if cursor:
        cursor_created_at, cursor_id = _decode_pagination_cursor(cursor)

    total = repository.count_by_registration_status(db, RegistrationStatus.PENDING)
    restaurants = repository.list_by_registration_status(
        db,
        RegistrationStatus.PENDING,
        limit=limit + 1,
        cursor_created_at=cursor_created_at,
        cursor_id=cursor_id,
        sort_order=sort_order,
    )
    has_more = len(restaurants) > limit
    current_page = restaurants[:limit]

    next_cursor: str | None = None
    if has_more and current_page:
        last = current_page[-1]
        next_cursor = _encode_pagination_cursor(last.created_at, last.id)

    items = [
        _serialize_registration_summary_with_db(db, restaurant)
        for restaurant in current_page
    ]
    return PendingRestaurantRegistrationListResponse(
        items=items,
        total=total,
        next_cursor=next_cursor,
        has_more=has_more,
    )


def get_pending_restaurant_registrations_count(db: Session) -> int:
    return repository.count_by_registration_status(db, RegistrationStatus.PENDING)


def list_restaurant_registration_history(
    db: Session,
    *,
    registration_status: RegistrationStatus | None,
    limit: int = 100,
    cursor: str | None = None,
    sort_order: str = "newest",
) -> RestaurantRegistrationHistoryListResponse:
    cursor_reviewed_at: datetime | None = None
    cursor_id: int | None = None
    if cursor:
        cursor_reviewed_at, cursor_id = _decode_pagination_cursor(cursor)

    total = repository.count_reviewed_registrations(
        db,
        registration_status=registration_status,
    )
    restaurants = repository.list_reviewed_registrations(
        db,
        registration_status=registration_status,
        limit=limit + 1,
        cursor_reviewed_at=cursor_reviewed_at,
        cursor_id=cursor_id,
        sort_order=sort_order,
    )
    has_more = len(restaurants) > limit
    current_page = restaurants[:limit]

    next_cursor: str | None = None
    if has_more and current_page:
        last = current_page[-1]
        review_marker = last.registration_reviewed_at or last.updated_at
        next_cursor = _encode_pagination_cursor(review_marker, last.id)

    items = [
        _serialize_registration_summary_with_db(db, restaurant)
        for restaurant in current_page
    ]
    return RestaurantRegistrationHistoryListResponse(
        items=items,
        total=total,
        next_cursor=next_cursor,
        has_more=has_more,
    )


def create_restaurant(
    db: Session,
    payload: RestaurantCreateRequest,
    *,
    current_user_id: int | None = None,
) -> RestaurantMeResponse:
    """Create a new restaurant tenant. Restricted to super_admin use only."""
    if payload.email and get_user_by_email(db, str(payload.email)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this restaurant email already exists.",
        )

    create_data = _build_profile_update_data(db, payload)
    change_reason = (
        str(create_data.get("change_reason")).strip()
        if create_data.get("change_reason")
        else None
    )

    restaurant = repository.create_restaurant(
        db,
        name=str(create_data["name"]),
        email=str(create_data["email"]) if create_data.get("email") else None,
        phone=str(create_data["phone"]) if create_data.get("phone") else None,
        address=str(create_data["address"]) if create_data.get("address") else None,
        country_id=create_data.get("country_id"),
        currency_id=create_data.get("currency_id"),
        country=str(create_data["country"]) if create_data.get("country") else None,
        currency=str(create_data["currency"]) if create_data.get("currency") else None,
        billing_email=str(create_data["billing_email"]) if create_data.get("billing_email") else None,
        public_menu_banner_urls_json=(
            str(create_data["public_menu_banner_urls_json"])
            if create_data.get("public_menu_banner_urls_json") is not None
            else None
        ),
        opening_time=str(create_data["opening_time"]) if create_data.get("opening_time") else None,
        closing_time=str(create_data["closing_time"]) if create_data.get("closing_time") else None,
    )

    subscription_service.assign_initial_trial_subscription(
        db,
        restaurant.id,
        actor_user_id=current_user_id,
        change_reason="Initial trial assigned when the hotel was provisioned by super admin.",
        source="super_admin",
        emit_live_notification=bool(current_user_id),
    )

    if restaurant.email:
        temporary_password = _generate_temporary_password()
        admin_user = create_staff(
            db,
            restaurant.id,
            StaffCreateRequest(
                full_name=f"{restaurant.name} Admin",
                email=restaurant.email,
                password=temporary_password,
                role=UserRole.admin,
                restaurant_id=restaurant.id,
            ),
            must_change_password=True,
        )

        sent = send_onboarding_email(
            recipient_email=admin_user.email,
            recipient_name=admin_user.full_name,
            restaurant_name=restaurant.name,
            temporary_password=temporary_password,
        )

        write_audit_log(
            db,
            event_type="restaurant_admin_onboarding_created",
            user_id=admin_user.id,
            metadata={
                "restaurant_id": restaurant.id,
                "email_sent": sent,
            },
        )

    if current_user_id is not None:
        _write_restaurant_mutation_audit(
            db,
            event_type="restaurant_created_by_super_admin",
            current_user_id=current_user_id,
            restaurant_id=restaurant.id,
            reason=change_reason,
            default_reason="Restaurant provisioned by super admin.",
            before_state={},
            after_state=_restaurant_lifecycle_snapshot(restaurant),
            extra_metadata={
                "email_present": bool(restaurant.email),
            },
        )

    return _serialize_restaurant(restaurant)


def reset_restaurant_staff_password(
    db: Session,
    *,
    restaurant_id: int,
    user_id: int,
    payload: RestaurantStaffPasswordResetRequest,
    current_user_id: int,
) -> RestaurantStaffPasswordResetResponse:
    restaurant = repository.get_by_id_for_super_admin(db, restaurant_id)
    if restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )

    user = get_by_id(db, user_id, restaurant_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found.",
        )

    if user.role not in _RESETTABLE_HOTEL_STAFF_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Temporary password reset is allowed only for owner/admin accounts.",
        )

    temporary_password = (
        payload.temporary_password.strip()
        if payload.temporary_password and payload.temporary_password.strip()
        else _generate_temporary_password()
    )
    _assert_temporary_password_policy(temporary_password)

    user.password_hash = hash_password(temporary_password)
    user.must_change_password = True
    user.password_changed_at = None
    db.commit()
    db.refresh(user)

    email_sent = send_temporary_password_reset_email(
        recipient_email=user.email,
        recipient_name=user.full_name,
        restaurant_name=restaurant.name,
        temporary_password=temporary_password,
    )

    reveal_token: str | None = None
    reveal_expires_at: datetime | None = None
    if email_sent:
        message = "Temporary password issued and sent to the user's email."
    else:
        reveal_token, reveal_expires_at = _issue_staff_password_reveal_token(
            db,
            restaurant_id=restaurant_id,
            user_id=user.id,
            current_user_id=current_user_id,
            temporary_password=temporary_password,
        )
        message = (
            "Temporary password issued. Email delivery failed; use the secure one-time reveal flow."
        )

    write_audit_log(
        db,
        event_type="restaurant_staff_password_reset_by_super_admin",
        user_id=current_user_id,
        restaurant_id=restaurant_id,
        metadata={
            "restaurant_id": restaurant_id,
            "target_user_id": user.id,
            "target_role": user.role.value,
            "email_sent": email_sent,
            "secure_reveal_issued": not email_sent,
        },
    )

    return RestaurantStaffPasswordResetResponse(
        message=message,
        user_id=user.id,
        role=user.role.value,
        must_change_password=user.must_change_password,
        email_sent=email_sent,
        reveal_token=reveal_token,
        reveal_expires_at=reveal_expires_at,
    )


def reveal_restaurant_staff_temporary_password(
    db: Session,
    *,
    restaurant_id: int,
    user_id: int,
    reveal_token: str,
    current_user_id: int,
) -> RestaurantStaffPasswordRevealResponse:
    restaurant = repository.get_by_id_for_super_admin(db, restaurant_id)
    if restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )

    user = get_by_id(db, user_id, restaurant_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found.",
        )

    temporary_password, revealed_at = _consume_staff_password_reveal_token(
        db,
        restaurant_id=restaurant_id,
        user_id=user_id,
        current_user_id=current_user_id,
        reveal_token=reveal_token,
    )

    write_audit_log(
        db,
        event_type="restaurant_staff_password_reset_revealed_by_super_admin",
        user_id=current_user_id,
        restaurant_id=restaurant_id,
        metadata={
            "restaurant_id": restaurant_id,
            "target_user_id": user.id,
            "target_role": user.role.value,
        },
    )

    return RestaurantStaffPasswordRevealResponse(
        message="Temporary password revealed. This value cannot be viewed again.",
        user_id=user.id,
        temporary_password=temporary_password,
        revealed_at=revealed_at,
    )


def update_restaurant_for_super_admin(
    db: Session,
    restaurant_id: int,
    payload: RestaurantAdminUpdateRequest,
    *,
    current_user_id: int,
) -> RestaurantMeResponse:
    """Update any restaurant by ID. Restricted to super_admin use only."""
    current_restaurant = repository.get_by_id_for_super_admin(db, restaurant_id)
    if current_restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    before_state = _restaurant_lifecycle_snapshot(current_restaurant)
    update_data = _build_profile_update_data(
        db,
        payload,
        existing_primary_email=current_restaurant.email,
        existing_billing_email=current_restaurant.billing_email,
    )
    change_reason = (
        str(update_data.pop("change_reason")).strip()
        if update_data.get("change_reason")
        else None
    )
    restaurant = repository.update_for_super_admin(db, restaurant_id, update_data)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )

    _write_restaurant_mutation_audit(
        db,
        event_type="restaurant_profile_updated_by_super_admin",
        current_user_id=current_user_id,
        restaurant_id=restaurant.id,
        reason=change_reason,
        default_reason="Restaurant profile updated by super admin.",
        before_state=before_state,
        after_state=_restaurant_lifecycle_snapshot(restaurant),
    )

    return _serialize_restaurant(restaurant)


def update_restaurant_integration_settings(
    db: Session,
    *,
    restaurant_id: int,
    payload: RestaurantIntegrationUpdateRequest,
    current_user_id: int,
) -> RestaurantIntegrationResponse:
    restaurant = repository.get_by_id_for_super_admin(db, restaurant_id)
    if restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    previous_webhook_url = restaurant.integration_webhook_url

    if "public_ordering_enabled" in update_data:
        restaurant.integration_public_ordering_enabled = bool(
            update_data["public_ordering_enabled"]
        )

    if "webhook_url" in update_data:
        restaurant.integration_webhook_url = (
            str(update_data["webhook_url"]).strip() if update_data["webhook_url"] else None
        )
    if "webhook_secret_header_name" in update_data:
        header_name = (
            str(update_data["webhook_secret_header_name"]).strip()
            if update_data["webhook_secret_header_name"]
            else None
        )
        restaurant.integration_webhook_secret_header_name = header_name

    if not restaurant.integration_public_ordering_enabled:
        restaurant.integration_webhook_status = WebhookHealthStatus.disabled
        restaurant.integration_webhook_last_error = "Public ordering integration is disabled."
    elif not restaurant.integration_webhook_url:
        restaurant.integration_webhook_status = WebhookHealthStatus.not_configured
        restaurant.integration_webhook_last_checked_at = None
        restaurant.integration_webhook_last_error = None
    elif previous_webhook_url != restaurant.integration_webhook_url:
        restaurant.integration_webhook_status = WebhookHealthStatus.degraded
        restaurant.integration_webhook_last_checked_at = None
        restaurant.integration_webhook_last_error = "Webhook endpoint updated. Run a health check."
    elif restaurant.integration_webhook_status == WebhookHealthStatus.disabled:
        restaurant.integration_webhook_status = WebhookHealthStatus.degraded
        restaurant.integration_webhook_last_error = (
            "Webhook endpoint is configured but not validated yet."
        )

    if (
        restaurant.integration_webhook_secret_ciphertext
        and not restaurant.integration_webhook_secret_header_name
    ):
        restaurant.integration_webhook_secret_header_name = DEFAULT_WEBHOOK_SECRET_HEADER_NAME

    db.commit()
    db.refresh(restaurant)

    write_audit_log(
        db,
        event_type="restaurant_integration_updated",
        user_id=current_user_id,
        metadata={
            "restaurant_id": restaurant.id,
            "public_ordering_enabled": restaurant.integration_public_ordering_enabled,
            "webhook_url": restaurant.integration_webhook_url,
            "webhook_secret_header_name": restaurant.integration_webhook_secret_header_name,
        },
    )

    return _build_integration_response(restaurant)


def provision_restaurant_api_key(
    db: Session,
    *,
    restaurant_id: int,
    current_user_id: int,
    rotate: bool,
) -> RestaurantApiKeyProvisionResponse:
    restaurant = repository.get_by_id_for_super_admin(db, restaurant_id)
    if restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )

    api_key = _generate_restaurant_api_key()
    restaurant.integration_api_key_hash = hash_token(api_key)
    restaurant.integration_api_key_prefix = api_key[:12]
    restaurant.integration_api_key_last4 = api_key[-4:]
    restaurant.integration_api_key_active = True
    restaurant.integration_api_key_rotated_at = datetime.now(UTC)

    db.commit()
    db.refresh(restaurant)

    write_audit_log(
        db,
        event_type="restaurant_api_key_rotated" if rotate else "restaurant_api_key_generated",
        user_id=current_user_id,
        metadata={"restaurant_id": restaurant.id},
    )

    return RestaurantApiKeyProvisionResponse(
        message="API key rotated successfully." if rotate else "API key generated successfully.",
        api_key=api_key,
        summary=_build_api_key_summary(restaurant),
    )


def revoke_restaurant_api_key(
    db: Session,
    *,
    restaurant_id: int,
    current_user_id: int,
) -> RestaurantApiKeySummaryResponse:
    restaurant = repository.get_by_id_for_super_admin(db, restaurant_id)
    if restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )

    restaurant.integration_api_key_hash = None
    restaurant.integration_api_key_prefix = None
    restaurant.integration_api_key_last4 = None
    restaurant.integration_api_key_active = False

    db.commit()
    db.refresh(restaurant)

    write_audit_log(
        db,
        event_type="restaurant_api_key_revoked",
        user_id=current_user_id,
        metadata={"restaurant_id": restaurant.id},
    )

    return _build_api_key_summary(restaurant)


def refresh_restaurant_webhook_health(
    db: Session,
    *,
    restaurant_id: int,
    current_user_id: int,
) -> RestaurantWebhookHealthRefreshResponse:
    restaurant = repository.get_by_id_for_super_admin(db, restaurant_id)
    if restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )

    if not restaurant.integration_webhook_url:
        restaurant.integration_webhook_status = WebhookHealthStatus.not_configured
        restaurant.integration_webhook_last_checked_at = None
        restaurant.integration_webhook_last_error = None
        message = "Webhook health reset because no endpoint is configured."
    elif not restaurant.integration_public_ordering_enabled:
        restaurant.integration_webhook_status = WebhookHealthStatus.disabled
        restaurant.integration_webhook_last_checked_at = datetime.now(UTC)
        restaurant.integration_webhook_last_error = "Public ordering integration is disabled."
        message = "Webhook health marked as disabled while public ordering is turned off."
    else:
        is_healthy, error_message = _probe_webhook_url(restaurant.integration_webhook_url)
        restaurant.integration_webhook_status = (
            WebhookHealthStatus.healthy if is_healthy else WebhookHealthStatus.degraded
        )
        restaurant.integration_webhook_last_checked_at = datetime.now(UTC)
        restaurant.integration_webhook_last_error = error_message
        message = (
            "Webhook endpoint is reachable."
            if is_healthy
            else "Webhook endpoint check failed."
        )

    db.commit()
    db.refresh(restaurant)

    write_audit_log(
        db,
        event_type="restaurant_webhook_health_checked",
        user_id=current_user_id,
        metadata={
            "restaurant_id": restaurant.id,
            "webhook_status": restaurant.integration_webhook_status.value,
        },
    )

    return RestaurantWebhookHealthRefreshResponse(
        message=message,
        settings=_build_integration_settings(restaurant),
    )


def delete_restaurant_for_super_admin(
    db: Session,
    restaurant_id: int,
    *,
    current_user_id: int,
    reason: str | None = None,
) -> RestaurantDeleteResponse:
    """Delete any restaurant by ID. Restricted to super_admin use only."""
    current_restaurant = repository.get_by_id_for_super_admin(db, restaurant_id)
    if current_restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )

    before_state = _restaurant_lifecycle_snapshot(current_restaurant)
    try:
        deleted = repository.delete_for_super_admin(db, restaurant_id)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Restaurant cannot be deleted due to related records.",
        ) from exc

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )

    _write_restaurant_mutation_audit(
        db,
        event_type="restaurant_deleted_by_super_admin",
        current_user_id=current_user_id,
        restaurant_id=restaurant_id,
        reason=reason,
        default_reason="Restaurant tenant deleted by super admin.",
        before_state=before_state,
        after_state={
            "restaurant_id": restaurant_id,
            "is_deleted": True,
        },
    )

    return RestaurantDeleteResponse(
        message="Restaurant deleted successfully.",
        restaurant_id=restaurant_id,
    )


def review_restaurant_registration(
    db: Session,
    *,
    restaurant_id: int,
    reviewer_user_id: int,
    payload: RestaurantRegistrationReviewRequest,
) -> RestaurantRegistrationReviewResponse:
    restaurant = repository.get_by_id_for_super_admin(db, restaurant_id)
    if restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )

    if restaurant.registration_status != RegistrationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending registrations can be reviewed.",
        )

    before_state = _restaurant_lifecycle_snapshot(restaurant)

    restaurant.registration_reviewed_by_id = reviewer_user_id
    restaurant.registration_review_notes = payload.review_notes
    restaurant.registration_reviewed_at = datetime.now(UTC)

    users = list_by_restaurant(db, restaurant.id)

    approved = payload.status == RegistrationStatus.APPROVED.value
    if approved:
        restaurant.registration_status = RegistrationStatus.APPROVED
        restaurant.is_active = True
        for user in users:
            user.is_active = True
        subscription_service.assign_initial_trial_subscription(
            db,
            restaurant.id,
            actor_user_id=reviewer_user_id,
            change_reason=payload.review_notes or "Registration approved.",
            source="registration_review",
            commit=False,
        )
        message = "Registration approved. Trial subscription activated."
        audit_event = "restaurant_registration_approved"
    else:
        restaurant.registration_status = RegistrationStatus.REJECTED
        restaurant.is_active = False
        for user in users:
            user.is_active = False
        message = "Registration rejected."
        audit_event = "restaurant_registration_rejected"

    db.commit()
    db.refresh(restaurant)

    notification_metadata: dict[str, object] = {}
    if approved:
        notification_metadata = _send_registration_approval_notifications(
            db,
            restaurant=restaurant,
            review_notes=payload.review_notes,
        )

    _write_restaurant_mutation_audit(
        db,
        event_type=audit_event,
        current_user_id=reviewer_user_id,
        restaurant_id=restaurant.id,
        reason=payload.review_notes,
        default_reason=(
            "Registration approved by super admin."
            if approved
            else "Registration rejected by super admin."
        ),
        before_state=before_state,
        after_state=_restaurant_lifecycle_snapshot(restaurant),
        extra_metadata={
            "review_notes": payload.review_notes,
            **notification_metadata,
        },
    )

    return RestaurantRegistrationReviewResponse(
        message=message,
        registration=_serialize_registration_summary_with_db(db, restaurant),
    )


def bulk_review_restaurant_registrations(
    db: Session,
    *,
    reviewer_user_id: int,
    payload: RestaurantRegistrationBulkReviewRequest,
) -> RestaurantRegistrationBulkReviewResponse:
    unique_ids = list(dict.fromkeys(payload.restaurant_ids))
    results: list[RestaurantRegistrationBulkReviewResultItem] = []
    succeeded = 0

    for restaurant_id in unique_ids:
        try:
            review_restaurant_registration(
                db,
                restaurant_id=restaurant_id,
                reviewer_user_id=reviewer_user_id,
                payload=RestaurantRegistrationReviewRequest(
                    status=payload.status,
                    review_notes=payload.review_notes,
                ),
            )
            results.append(
                RestaurantRegistrationBulkReviewResultItem(
                    restaurant_id=restaurant_id,
                    status="ok",
                    message="Reviewed successfully.",
                )
            )
            succeeded += 1
        except HTTPException as exc:
            results.append(
                RestaurantRegistrationBulkReviewResultItem(
                    restaurant_id=restaurant_id,
                    status="error",
                    message=str(exc.detail),
                )
            )

    failed = len(unique_ids) - succeeded
    return RestaurantRegistrationBulkReviewResponse(
        total_requested=len(unique_ids),
        succeeded=succeeded,
        failed=failed,
        results=results,
    )


def _assert_temporary_password_policy(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Temporary password must be at least 8 characters.",
        )
    if not any(char.isupper() for char in password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Temporary password must contain at least one uppercase letter.",
        )
    if not any(char.islower() for char in password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Temporary password must contain at least one lowercase letter.",
        )
    if not any(char.isdigit() for char in password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Temporary password must contain at least one number.",
        )


def _generate_temporary_password(length: int = 12) -> str:
    if length < 8:
        length = 8

    required_chars = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice("@#$%!"),
    ]
    alphabet = string.ascii_letters + string.digits + "@#$%!"
    remaining_chars = [
        secrets.choice(alphabet)
        for _ in range(length - len(required_chars))
    ]
    password_chars = required_chars + remaining_chars
    secrets.SystemRandom().shuffle(password_chars)
    return "".join(password_chars)


def _issue_staff_password_reveal_token(
    db: Session,
    *,
    restaurant_id: int,
    user_id: int,
    current_user_id: int,
    temporary_password: str,
) -> tuple[str, datetime]:
    raw_token = generate_secure_token()
    expires_at = datetime.now(UTC) + timedelta(minutes=_STAFF_PASSWORD_REVEAL_TTL_MINUTES)

    record = RestaurantPasswordRevealToken(
        restaurant_id=restaurant_id,
        target_user_id=user_id,
        created_by_user_id=current_user_id,
        token_hash=hash_token(raw_token),
        temporary_password_ciphertext=encrypt_secret_value(temporary_password),
        expires_at=expires_at,
    )
    db.add(record)
    db.commit()

    return raw_token, expires_at


def _consume_staff_password_reveal_token(
    db: Session,
    *,
    restaurant_id: int,
    user_id: int,
    current_user_id: int,
    reveal_token: str,
) -> tuple[str, datetime]:
    token_hash_value = hash_token(reveal_token)
    record = (
        db.query(RestaurantPasswordRevealToken)
        .filter(
            RestaurantPasswordRevealToken.restaurant_id == restaurant_id,
            RestaurantPasswordRevealToken.target_user_id == user_id,
            RestaurantPasswordRevealToken.created_by_user_id == current_user_id,
            RestaurantPasswordRevealToken.token_hash == token_hash_value,
        )
        .first()
    )
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_STAFF_PASSWORD_REVEAL_INVALID_DETAIL,
        )

    now = datetime.now(UTC)
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)

    if record.used_at is not None or expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_STAFF_PASSWORD_REVEAL_INVALID_DETAIL,
        )

    temporary_password = decrypt_secret_value(record.temporary_password_ciphertext)
    if not temporary_password:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to reveal temporary password.",
        )

    record.used_at = now
    db.commit()

    return temporary_password, now


def _serialize_registration_summary_with_db(
    db: Session,
    restaurant,
) -> RestaurantRegistrationSummaryResponse:
    owner = repository.get_owner_user(db, restaurant.id)
    return RestaurantRegistrationSummaryResponse(
        restaurant_id=restaurant.id,
        name=restaurant.name,
        owner_user_id=owner.id if owner else None,
        owner_full_name=owner.full_name if owner else None,
        owner_email=owner.email if owner else restaurant.email,
        phone=restaurant.phone,
        address=restaurant.address,
        country=restaurant.country,
        currency=restaurant.currency,
        billing_email=_effective_billing_email(
            primary_email=restaurant.email,
            billing_email=restaurant.billing_email,
        ),
        opening_time=restaurant.opening_time,
        closing_time=restaurant.closing_time,
        logo_url=restaurant.logo_url,
        created_at=restaurant.created_at,
        registration_status=restaurant.registration_status.value,
        registration_reviewed_by_id=restaurant.registration_reviewed_by_id,
        registration_review_notes=restaurant.registration_review_notes,
        registration_reviewed_at=restaurant.registration_reviewed_at,
    )


def _with_normalized_reference_fields(
    db: Session,
    payload: RestaurantUpdateRequest | RestaurantCreateRequest | RestaurantAdminUpdateRequest,
) -> RestaurantUpdateRequest | RestaurantCreateRequest | RestaurantAdminUpdateRequest:
    update_data = payload.model_dump(exclude_unset=True)

    if "country_id" in update_data:
        resolved_country_id, resolved_country_name = reference_data_service.resolve_country_from_id_or_name(
            db,
            country_id=update_data.get("country_id"),
            country_name=None,
        )
        update_data["country_id"] = resolved_country_id
        update_data["country"] = resolved_country_name
    elif "country" in update_data:
        resolved_country_id, resolved_country_name = reference_data_service.resolve_country_from_id_or_name(
            db,
            country_id=None,
            country_name=update_data.get("country"),
        )
        update_data["country_id"] = resolved_country_id
        update_data["country"] = resolved_country_name

    if "currency_id" in update_data:
        resolved_currency_id, resolved_currency_code = reference_data_service.resolve_currency_from_id_or_value(
            db,
            currency_id=update_data.get("currency_id"),
            currency_value=None,
        )
        update_data["currency_id"] = resolved_currency_id
        update_data["currency"] = resolved_currency_code
    elif "currency" in update_data:
        resolved_currency_id, resolved_currency_code = reference_data_service.resolve_currency_from_id_or_value(
            db,
            currency_id=None,
            currency_value=update_data.get("currency"),
        )
        update_data["currency_id"] = resolved_currency_id
        update_data["currency"] = resolved_currency_code

    return payload.model_copy(update=update_data)
