"""Redis-backed cart repository.

Key design:
  {prefix}:{session_id}:{restaurant_id}

Default prefix is "cart" (table guest sessions).
Room cart uses prefix="room_cart" to keep namespaces separate.

Each key is a Redis hash where:
  field = str(item_id)
  value = str(quantity)

TTL is set/refreshed on every write operation so that idle carts expire
automatically. The TTL is configured via settings.cart_ttl_seconds.
"""

import redis as redis_lib

from app.core.config import settings


def _key(session_id: str, restaurant_id: int, prefix: str = "cart") -> str:
    """Build the canonical Redis key for a cart."""
    return f"{prefix}:{session_id}:{restaurant_id}"


def get_cart_raw(
    r: redis_lib.Redis,
    session_id: str,
    restaurant_id: int,
    prefix: str = "cart",
) -> dict[str, str]:
    """Return the raw hash contents of the cart (item_id -> quantity strings)."""
    return r.hgetall(_key(session_id, restaurant_id, prefix))  # type: ignore[return-value]


def set_cart_item(
    r: redis_lib.Redis,
    session_id: str,
    restaurant_id: int,
    item_id: int,
    quantity: int,
    prefix: str = "cart",
) -> None:
    """Set the quantity of a single item in the cart and refresh TTL."""
    key = _key(session_id, restaurant_id, prefix)
    r.hset(key, str(item_id), str(quantity))
    r.expire(key, settings.cart_ttl_seconds)


def remove_cart_item(
    r: redis_lib.Redis,
    session_id: str,
    restaurant_id: int,
    item_id: int,
    prefix: str = "cart",
) -> None:
    """Remove one item from the cart hash. Refreshes TTL if cart still has items."""
    key = _key(session_id, restaurant_id, prefix)
    r.hdel(key, str(item_id))
    # Refresh TTL only if the cart still has items
    if r.hlen(key):
        r.expire(key, settings.cart_ttl_seconds)


def clear_cart(
    r: redis_lib.Redis,
    session_id: str,
    restaurant_id: int,
    prefix: str = "cart",
) -> None:
    """Delete the entire cart key from Redis."""
    r.delete(_key(session_id, restaurant_id, prefix))


def refresh_cart_ttl(
    r: redis_lib.Redis,
    session_id: str,
    restaurant_id: int,
    prefix: str = "cart",
) -> None:
    """Extend the cart TTL without changing its contents."""
    r.expire(_key(session_id, restaurant_id, prefix), settings.cart_ttl_seconds)
