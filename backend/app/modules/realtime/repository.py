"""Real-time repository — Redis pub/sub helpers.

Responsibilities:
- Derive restaurant-scoped channel names
- Serialize and publish events to Redis
"""
from __future__ import annotations

import json
from datetime import datetime

import redis as redis_lib


def get_order_channel(restaurant_id: int) -> str:
    """Return the Redis pub/sub channel for a restaurant's orders."""
    return f"orders:{restaurant_id}"


def get_super_admin_channel() -> str:
    """Return the Redis pub/sub channel for platform-level super admin events."""
    return "platform:super_admin"


def _json_default(obj: object) -> str:
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def publish_event(r: redis_lib.Redis, restaurant_id: int, event: dict) -> None:
    """Publish a JSON-encoded event to the restaurant's Redis pub/sub channel.

    Uses the synchronous Redis client — safe to call from synchronous request
    handlers. The async subscription (WebSocket side) receives this message
    via its own async Redis client.
    """
    channel = get_order_channel(restaurant_id)
    payload = json.dumps(event, default=_json_default)
    r.publish(channel, payload)


def publish_global_event(
    r: redis_lib.Redis,
    channel: str,
    event: dict,
) -> None:
    payload = json.dumps(event, default=_json_default)
    r.publish(channel, payload)
