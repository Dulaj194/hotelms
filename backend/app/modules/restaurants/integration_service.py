from __future__ import annotations

import json
import secrets
import time
from datetime import UTC, datetime, timedelta
from urllib import error as urllib_error
from urllib import request as urllib_request

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import decrypt_secret_value, encrypt_secret_value
from app.modules.audit_logs.service import write_audit_log
from app.modules.realtime import service as realtime_service
from app.modules.restaurants import repository
from app.modules.restaurants.model import (
    Restaurant,
    RestaurantWebhookDelivery,
    WebhookDeliveryStatus,
    WebhookHealthStatus,
)
from app.modules.restaurants.schemas import (
    RestaurantIntegrationOpsResponse,
    RestaurantWebhookDeliveryActionResponse,
    RestaurantWebhookDeliveryActorResponse,
    RestaurantWebhookDeliveryResponse,
    RestaurantWebhookFailureTrendPointResponse,
    RestaurantWebhookSecretProvisionResponse,
    RestaurantWebhookSecretSummaryResponse,
)
from app.modules.users.model import User

DEFAULT_WEBHOOK_SECRET_HEADER_NAME = "X-HotelMS-Webhook-Secret"
TEST_WEBHOOK_EVENT_TYPE = "hotelms.integration.ping"
_DELIVERY_TIMEOUT_SECONDS = 8.0
_MAX_RESPONSE_EXCERPT_LENGTH = 300


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _mask_secret_value(last4: str | None) -> str | None:
    if not last4:
        return None
    return f"****{last4}"


def _get_restaurant_or_404(db: Session, restaurant_id: int) -> Restaurant:
    restaurant = repository.get_by_id_for_super_admin(db, restaurant_id)
    if restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    return restaurant


def _build_webhook_secret_summary(restaurant: Restaurant) -> RestaurantWebhookSecretSummaryResponse:
    return RestaurantWebhookSecretSummaryResponse(
        has_secret=bool(restaurant.integration_webhook_secret_ciphertext),
        header_name=restaurant.integration_webhook_secret_header_name,
        masked_value=_mask_secret_value(restaurant.integration_webhook_secret_last4),
        rotated_at=restaurant.integration_webhook_secret_rotated_at,
    )


def _serialize_actor(user: User | None) -> RestaurantWebhookDeliveryActorResponse:
    return RestaurantWebhookDeliveryActorResponse(
        user_id=user.id if user else None,
        full_name=user.full_name if user else None,
        email=user.email if user else None,
    )


def _serialize_delivery(
    delivery: RestaurantWebhookDelivery,
    actor_map: dict[int, User],
) -> RestaurantWebhookDeliveryResponse:
    actor = actor_map.get(delivery.triggered_by_user_id) if delivery.triggered_by_user_id else None
    return RestaurantWebhookDeliveryResponse(
        id=delivery.id,
        event_type=delivery.event_type,
        request_url=delivery.request_url,
        delivery_status=delivery.delivery_status.value,
        attempt_number=delivery.attempt_number,
        is_retry=delivery.is_retry,
        retried_from_delivery_id=delivery.retried_from_delivery_id,
        http_status_code=delivery.http_status_code,
        error_message=delivery.error_message,
        response_excerpt=delivery.response_excerpt,
        response_time_ms=delivery.response_time_ms,
        triggered_by=_serialize_actor(actor),
        created_at=delivery.created_at,
    )


def _clip_text(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    return cleaned[:_MAX_RESPONSE_EXCERPT_LENGTH]


def _generate_webhook_secret() -> str:
    return f"hmswh_{secrets.token_hex(18)}"


def _build_delivery_headers(restaurant: Restaurant, event_type: str) -> dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "hotelms-webhook/1.0",
        "X-HotelMS-Event": event_type,
    }
    secret_value = decrypt_secret_value(restaurant.integration_webhook_secret_ciphertext)
    header_name = restaurant.integration_webhook_secret_header_name
    if secret_value and header_name:
        headers[header_name] = secret_value
    return headers


def _send_webhook_request(
    *,
    request_url: str,
    headers: dict[str, str],
    payload_bytes: bytes,
) -> tuple[str, int | None, str | None, str | None, int]:
    started_at = time.monotonic()
    try:
        request = urllib_request.Request(
            request_url,
            data=payload_bytes,
            headers=headers,
            method="POST",
        )
        with urllib_request.urlopen(request, timeout=_DELIVERY_TIMEOUT_SECONDS) as response:
            status_code = int(getattr(response, "status", 200))
            response_excerpt = _clip_text(response.read().decode("utf-8", errors="ignore"))
            elapsed_ms = int((time.monotonic() - started_at) * 1000)
            if 200 <= status_code < 300:
                return "success", status_code, None, response_excerpt, elapsed_ms
            return (
                "failed",
                status_code,
                f"Webhook returned HTTP {status_code}.",
                response_excerpt,
                elapsed_ms,
            )
    except urllib_error.HTTPError as exc:
        response_excerpt = _clip_text(exc.read().decode("utf-8", errors="ignore"))
        elapsed_ms = int((time.monotonic() - started_at) * 1000)
        return (
            "failed",
            exc.code,
            f"Webhook returned HTTP {exc.code}.",
            response_excerpt,
            elapsed_ms,
        )
    except Exception as exc:  # pragma: no cover - depends on runtime network access
        elapsed_ms = int((time.monotonic() - started_at) * 1000)
        return ("failed", None, str(exc) or "Unable to reach the webhook endpoint.", None, elapsed_ms)


def _build_test_event_payload(
    restaurant: Restaurant,
    *,
    event_type: str,
    is_retry: bool,
    source_delivery_id: int | None,
) -> dict[str, object]:
    return {
        "event": event_type,
        "generated_at": _utcnow().isoformat(),
        "restaurant": {
            "id": restaurant.id,
            "name": restaurant.name,
            "public_ordering_enabled": restaurant.integration_public_ordering_enabled,
        },
        "delivery_context": {
            "kind": "retry" if is_retry else "manual_test",
            "retried_from_delivery_id": source_delivery_id,
        },
    }


def _apply_webhook_health_after_delivery(
    restaurant: Restaurant,
    *,
    succeeded: bool,
    error_message: str | None,
) -> None:
    restaurant.integration_webhook_last_checked_at = _utcnow()
    if not restaurant.integration_public_ordering_enabled:
        restaurant.integration_webhook_status = WebhookHealthStatus.disabled
        if error_message:
            restaurant.integration_webhook_last_error = (
                f"Public ordering integration is disabled. Last test: {error_message}"
            )
        else:
            restaurant.integration_webhook_last_error = "Public ordering integration is disabled."
        return

    if succeeded:
        restaurant.integration_webhook_status = WebhookHealthStatus.healthy
        restaurant.integration_webhook_last_error = None
        return

    restaurant.integration_webhook_status = WebhookHealthStatus.degraded
    restaurant.integration_webhook_last_error = error_message or "Webhook delivery failed."


def _record_delivery_audit_event(
    *,
    db: Session,
    restaurant: Restaurant,
    current_user_id: int,
    delivery: RestaurantWebhookDelivery,
) -> None:
    if delivery.delivery_status != WebhookDeliveryStatus.failed:
        return
    audit_log = write_audit_log(
        db,
        event_type="restaurant_webhook_delivery_failed",
        user_id=current_user_id,
        restaurant_id=restaurant.id,
        metadata={
            "restaurant_id": restaurant.id,
            "webhook_event_type": delivery.event_type,
            "request_url": delivery.request_url,
            "attempt_number": delivery.attempt_number,
            "is_retry": delivery.is_retry,
            "http_status_code": delivery.http_status_code,
            "error_message": delivery.error_message,
        },
    )
    if audit_log is not None:
        realtime_service.publish_super_admin_audit_notification(
            audit_log=audit_log,
            restaurant_id=restaurant.id,
        )


def _record_secret_audit_event(
    *,
    db: Session,
    restaurant: Restaurant,
    current_user_id: int,
    event_type: str,
) -> None:
    audit_log = write_audit_log(
        db,
        event_type=event_type,
        user_id=current_user_id,
        restaurant_id=restaurant.id,
        metadata={
            "restaurant_id": restaurant.id,
            "header_name": restaurant.integration_webhook_secret_header_name,
        },
    )
    if audit_log is not None:
        realtime_service.publish_super_admin_audit_notification(
            audit_log=audit_log,
            restaurant_id=restaurant.id,
        )


def get_restaurant_integration_ops(
    db: Session,
    *,
    restaurant_id: int,
    recent_limit: int = 12,
) -> RestaurantIntegrationOpsResponse:
    restaurant = _get_restaurant_or_404(db, restaurant_id)
    recent_deliveries = (
        db.query(RestaurantWebhookDelivery)
        .filter(RestaurantWebhookDelivery.restaurant_id == restaurant.id)
        .order_by(RestaurantWebhookDelivery.created_at.desc(), RestaurantWebhookDelivery.id.desc())
        .limit(recent_limit)
        .all()
    )
    triggered_by_ids = {
        delivery.triggered_by_user_id
        for delivery in recent_deliveries
        if delivery.triggered_by_user_id is not None
    }
    actor_map = {
        user.id: user
        for user in db.query(User).filter(User.id.in_(triggered_by_ids)).all()
    } if triggered_by_ids else {}

    last_successful_delivery = next(
        (delivery for delivery in recent_deliveries if delivery.delivery_status == WebhookDeliveryStatus.success),
        None,
    )
    if last_successful_delivery is None:
        last_successful_delivery = (
            db.query(RestaurantWebhookDelivery)
            .filter(
                RestaurantWebhookDelivery.restaurant_id == restaurant.id,
                RestaurantWebhookDelivery.delivery_status == WebhookDeliveryStatus.success,
            )
            .order_by(
                RestaurantWebhookDelivery.created_at.desc(),
                RestaurantWebhookDelivery.id.desc(),
            )
            .first()
        )
        if last_successful_delivery and last_successful_delivery.triggered_by_user_id is not None:
            actor = db.query(User).filter(User.id == last_successful_delivery.triggered_by_user_id).first()
            if actor is not None:
                actor_map[actor.id] = actor

    trend_start = (_utcnow() - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
    trend_deliveries = (
        db.query(RestaurantWebhookDelivery)
        .filter(
            RestaurantWebhookDelivery.restaurant_id == restaurant.id,
            RestaurantWebhookDelivery.created_at >= trend_start,
        )
        .all()
    )
    failure_counts = {
        (trend_start + timedelta(days=offset)).date().isoformat(): 0
        for offset in range(7)
    }
    for delivery in trend_deliveries:
        if delivery.delivery_status != WebhookDeliveryStatus.failed:
            continue
        failure_counts[delivery.created_at.date().isoformat()] = (
            failure_counts.get(delivery.created_at.date().isoformat(), 0) + 1
        )

    return RestaurantIntegrationOpsResponse(
        secret=_build_webhook_secret_summary(restaurant),
        last_delivery=(
            _serialize_delivery(last_successful_delivery, actor_map)
            if last_successful_delivery is not None
            else None
        ),
        recent_deliveries=[
            _serialize_delivery(delivery, actor_map)
            for delivery in recent_deliveries
        ],
        failure_trend=[
            RestaurantWebhookFailureTrendPointResponse(date=date, failed_count=count)
            for date, count in failure_counts.items()
        ],
    )


def provision_restaurant_webhook_secret(
    db: Session,
    *,
    restaurant_id: int,
    current_user_id: int,
    rotate: bool,
) -> RestaurantWebhookSecretProvisionResponse:
    restaurant = _get_restaurant_or_404(db, restaurant_id)
    secret_value = _generate_webhook_secret()
    restaurant.integration_webhook_secret_header_name = (
        restaurant.integration_webhook_secret_header_name or DEFAULT_WEBHOOK_SECRET_HEADER_NAME
    )
    restaurant.integration_webhook_secret_ciphertext = encrypt_secret_value(secret_value)
    restaurant.integration_webhook_secret_last4 = secret_value[-4:]
    restaurant.integration_webhook_secret_rotated_at = _utcnow()
    db.commit()
    db.refresh(restaurant)

    _record_secret_audit_event(
        db=db,
        restaurant=restaurant,
        current_user_id=current_user_id,
        event_type="restaurant_webhook_secret_rotated" if rotate else "restaurant_webhook_secret_generated",
    )

    return RestaurantWebhookSecretProvisionResponse(
        message="Webhook secret rotated successfully." if rotate else "Webhook secret generated successfully.",
        secret_value=secret_value,
        summary=_build_webhook_secret_summary(restaurant),
    )


def revoke_restaurant_webhook_secret(
    db: Session,
    *,
    restaurant_id: int,
    current_user_id: int,
) -> RestaurantWebhookSecretSummaryResponse:
    restaurant = _get_restaurant_or_404(db, restaurant_id)
    restaurant.integration_webhook_secret_ciphertext = None
    restaurant.integration_webhook_secret_last4 = None
    restaurant.integration_webhook_secret_rotated_at = None
    db.commit()
    db.refresh(restaurant)

    _record_secret_audit_event(
        db=db,
        restaurant=restaurant,
        current_user_id=current_user_id,
        event_type="restaurant_webhook_secret_revoked",
    )

    return _build_webhook_secret_summary(restaurant)


def _create_delivery(
    db: Session,
    *,
    restaurant: Restaurant,
    current_user_id: int,
    event_type: str,
    payload: dict[str, object],
    attempt_number: int,
    is_retry: bool,
    retried_from_delivery_id: int | None,
    request_url: str,
) -> RestaurantWebhookDelivery:
    payload_json = json.dumps(payload, ensure_ascii=True, sort_keys=True)
    result_status, http_status_code, error_message, response_excerpt, response_time_ms = _send_webhook_request(
        request_url=request_url,
        headers=_build_delivery_headers(restaurant, event_type),
        payload_bytes=payload_json.encode(),
    )
    delivery = RestaurantWebhookDelivery(
        restaurant_id=restaurant.id,
        triggered_by_user_id=current_user_id,
        retried_from_delivery_id=retried_from_delivery_id,
        event_type=event_type,
        request_url=request_url,
        payload_json=payload_json,
        delivery_status=WebhookDeliveryStatus(result_status),
        attempt_number=attempt_number,
        is_retry=is_retry,
        http_status_code=http_status_code,
        error_message=error_message,
        response_excerpt=response_excerpt,
        response_time_ms=response_time_ms,
    )
    db.add(delivery)
    _apply_webhook_health_after_delivery(
        restaurant,
        succeeded=delivery.delivery_status == WebhookDeliveryStatus.success,
        error_message=error_message,
    )
    db.commit()
    db.refresh(delivery)
    db.refresh(restaurant)
    _record_delivery_audit_event(
        db=db,
        restaurant=restaurant,
        current_user_id=current_user_id,
        delivery=delivery,
    )
    return delivery


def send_restaurant_test_webhook_delivery(
    db: Session,
    *,
    restaurant_id: int,
    current_user_id: int,
) -> RestaurantWebhookDeliveryActionResponse:
    restaurant = _get_restaurant_or_404(db, restaurant_id)
    if not restaurant.integration_webhook_url:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Configure a webhook URL before sending a test delivery.",
        )

    delivery = _create_delivery(
        db,
        restaurant=restaurant,
        current_user_id=current_user_id,
        event_type=TEST_WEBHOOK_EVENT_TYPE,
        payload=_build_test_event_payload(
            restaurant,
            event_type=TEST_WEBHOOK_EVENT_TYPE,
            is_retry=False,
            source_delivery_id=None,
        ),
        attempt_number=1,
        is_retry=False,
        retried_from_delivery_id=None,
        request_url=restaurant.integration_webhook_url,
    )
    actor_map = {
        current_user_id: user
        for user in db.query(User).filter(User.id == current_user_id).all()
    }
    succeeded = delivery.delivery_status == WebhookDeliveryStatus.success
    return RestaurantWebhookDeliveryActionResponse(
        message="Test webhook delivered successfully." if succeeded else "Test webhook delivery failed.",
        delivery=_serialize_delivery(delivery, actor_map),
    )


def retry_restaurant_webhook_delivery(
    db: Session,
    *,
    restaurant_id: int,
    delivery_id: int,
    current_user_id: int,
) -> RestaurantWebhookDeliveryActionResponse:
    restaurant = _get_restaurant_or_404(db, restaurant_id)
    original_delivery = (
        db.query(RestaurantWebhookDelivery)
        .filter(
            RestaurantWebhookDelivery.id == delivery_id,
            RestaurantWebhookDelivery.restaurant_id == restaurant.id,
        )
        .first()
    )
    if original_delivery is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook delivery record not found.",
        )

    try:
        payload = json.loads(original_delivery.payload_json)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Original delivery payload is no longer available for retry.",
        ) from exc

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Original delivery payload is invalid for retry.",
        )

    delivery = _create_delivery(
        db,
        restaurant=restaurant,
        current_user_id=current_user_id,
        event_type=original_delivery.event_type,
        payload=payload,
        attempt_number=original_delivery.attempt_number + 1,
        is_retry=True,
        retried_from_delivery_id=original_delivery.id,
        request_url=restaurant.integration_webhook_url or original_delivery.request_url,
    )
    actor_map = {
        current_user_id: user
        for user in db.query(User).filter(User.id == current_user_id).all()
    }
    succeeded = delivery.delivery_status == WebhookDeliveryStatus.success
    return RestaurantWebhookDeliveryActionResponse(
        message="Webhook retry delivered successfully." if succeeded else "Webhook retry failed.",
        delivery=_serialize_delivery(delivery, actor_map),
    )
