"""Real-time service — helpers for building and publishing order events.

Wraps repository calls with structured event construction so that callers
(order service, etc.) never need to know the raw event shape.
"""
from __future__ import annotations

from datetime import UTC, datetime

import redis as redis_lib

from app.db.redis import get_redis_client
from app.db.session import SessionLocal
from app.modules.audit_logs.service import serialize_notification_entry
from app.modules.realtime import repository as realtime_repo


def publish_new_order(
    r: redis_lib.Redis,
    *,
    restaurant_id: int,
    order_id: int,
    order_number: str,
    table_number: str | None,
    order_source: str,
    room_id: int | None,
    room_number: str | None,
    status: str = "pending",
    total_amount: float,
    placed_at: datetime,
    items: list[dict],
) -> None:
    """Publish a new_order event to the restaurant's Redis pub/sub channel.

    Called immediately after a guest order is committed to the DB.
    """
    event = {
        "event": "new_order",
        "restaurant_id": restaurant_id,
        "data": {
            "order_id": order_id,
            "order_number": order_number,
            "table_number": table_number,
            "order_source": order_source,
            "room_id": room_id,
            "room_number": room_number,
            "status": status,
            "total_amount": total_amount,
            "placed_at": placed_at,
            "items": items,
        },
    }
    realtime_repo.publish_event(r, restaurant_id, event)


def publish_order_status_updated(
    r: redis_lib.Redis,
    *,
    restaurant_id: int,
    order_id: int,
    order_number: str,
    table_number: str | None,
    order_source: str,
    room_id: int | None,
    room_number: str | None,
    status: str,
    updated_at: datetime | None = None,
) -> None:
    """Publish an order_status_updated event after a successful status change."""
    event = {
        "event": "order_status_updated",
        "restaurant_id": restaurant_id,
        "data": {
            "order_id": order_id,
            "order_number": order_number,
            "table_number": table_number,
            "order_source": order_source,
            "room_id": room_id,
            "room_number": room_number,
            "status": status,
            "updated_at": updated_at or datetime.now(UTC),
        },
    }
    realtime_repo.publish_event(r, restaurant_id, event)


def _map_super_admin_event_name(event_type: str) -> str:
    if event_type == "settings_request_submitted":
        return "settings-request:new"
    if event_type in {"settings_request_approved", "settings_request_rejected"}:
        return "settings-request:reviewed"
    if event_type == "restaurant_registration_success":
        return "registration:new"
    if event_type in {"restaurant_registration_approved", "restaurant_registration_rejected"}:
        return "registration:reviewed"
    if event_type.startswith("subscription_"):
        return "subscription:updated"
    if event_type.startswith("platform_user_") or event_type.startswith("staff_"):
        return "user:updated"
    if event_type.startswith("restaurant_api_key_") or event_type.startswith("restaurant_webhook_"):
        return "integration:updated"
    if event_type.startswith("stripe_webhook_"):
        return "billing:alert"
    if event_type == "login_failed":
        return "security:alert"
    if event_type.startswith("site_page_") or event_type.startswith("site_blog_"):
        return "site-content:updated"
    if event_type == "site_contact_lead_updated":
        return "site-content:leads"
    if event_type.startswith("restaurant_") and event_type.endswith("_by_super_admin"):
        return "tenant:lifecycle"
    return "super-admin:notification"


def publish_super_admin_notification(notification: dict) -> None:
    redis_client = get_redis_client()
    realtime_repo.publish_global_event(
        redis_client,
        realtime_repo.get_super_admin_channel(),
        {
            "event": notification.get("event") or "super-admin:notification",
            "data": notification,
        },
    )


def publish_super_admin_audit_notification(
    *,
    audit_log,
    restaurant_id: int | None = None,
) -> None:
    db = SessionLocal()
    try:
        notification = serialize_notification_entry(db, audit_log).model_dump(mode="json")
        if restaurant_id is not None and notification.get("restaurant", {}).get("restaurant_id") is None:
            notification.setdefault("restaurant", {})
            notification["restaurant"]["restaurant_id"] = restaurant_id
        notification["event"] = _map_super_admin_event_name(notification["event_type"])
        publish_super_admin_notification(notification)
    except Exception:
        return
    finally:
        db.close()


def publish_bill_requested(
    r: redis_lib.Redis,
    *,
    restaurant_id: int,
    table_number: str,
    session_id: str,
    customer_name: str | None = None,
    order_source: str = "table",
) -> None:
    """Publish a bill_requested event to the staff channel.

    Alerts connected staff/waiters that a table is ready to pay.
    """
    event = {
        "event": "bill_requested",
        "restaurant_id": restaurant_id,
        "data": {
            "request_id": session_id, # Use session_id as ID for bill requests
            "table_number": table_number,
            "session_id": session_id,
            "customer_name": customer_name,
            "order_source": order_source,
            "requested_at": datetime.now(UTC),
        },
    }
    realtime_repo.publish_event(r, restaurant_id, event)


def publish_bill_acknowledged(
    r: redis_lib.Redis,
    *,
    restaurant_id: int,
    session_id: str,
    acknowledged_by: int,
) -> None:
    """Publish a bill_acknowledged event."""
    event = {
        "event": "bill_acknowledged",
        "restaurant_id": restaurant_id,
        "data": {
            "session_id": session_id,
            "acknowledged_by": acknowledged_by,
            "acknowledged_at": datetime.now(UTC),
        },
    }
    realtime_repo.publish_event(r, restaurant_id, event)


def publish_service_requested(
    r: redis_lib.Redis,
    *,
    restaurant_id: int,
    table_number: str,
    session_id: str,
    service_type: str,
    request_id: int | None = None,
    customer_name: str | None = None,
    message: str | None = None,
    order_source: str = "table",
) -> None:
    """Publish a service_requested event to the staff channel.

    Alerts connected staff/waiters that a table needs a specific service (Water, etc.).
    """
    event = {
        "event": "service_requested",
        "restaurant_id": restaurant_id,
        "data": {
            "request_id": request_id,
            "table_number": table_number,
            "session_id": session_id,
            "service_type": service_type,
            "customer_name": customer_name,
            "message": message,
            "order_source": order_source,
            "requested_at": datetime.now(UTC),
        },
    }
    realtime_repo.publish_event(r, restaurant_id, event)


def publish_service_acknowledged(
    r: redis_lib.Redis,
    *,
    restaurant_id: int,
    request_id: int,
    acknowledged_by: int,
) -> None:
    """Publish a service_acknowledged event.

    Allows other steward dashboards to remove this request from their view in real-time.
    """
    event = {
        "event": "service_acknowledged",
        "restaurant_id": restaurant_id,
        "data": {
            "request_id": request_id,
            "acknowledged_by": acknowledged_by,
            "acknowledged_at": datetime.now(UTC),
        },
    }
    realtime_repo.publish_event(r, restaurant_id, event)
