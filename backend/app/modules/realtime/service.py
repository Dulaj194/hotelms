"""Real-time service — helpers for building and publishing order events.

Wraps repository calls with structured event construction so that callers
(order service, etc.) never need to know the raw event shape.
"""
from __future__ import annotations

from datetime import UTC, datetime

import redis as redis_lib

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
            "status": "pending",
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
