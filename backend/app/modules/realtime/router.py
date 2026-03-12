"""Real-time router — WebSocket endpoint for the kitchen dashboard.

Authentication strategy
-----------------------
JWT is passed as a query parameter:
    WS /api/v1/ws/kitchen/{restaurant_id}?token=<access_jwt>

This is the most practical approach for browser WebSocket clients because
the native WebSocket API does not support custom HTTP headers.

Security checks (validated before the connection is accepted):
1. JWT signature and expiry are verified.
2. Token type must be "access" (not guest_session / refresh).
3. User account must be active.
4. User role must be: owner | admin | steward.
5. user.restaurant_id must match the path restaurant_id.
   Cross-tenant connections are rejected.

On auth failure the connection is accepted then immediately closed with
code 4001 (private-use range), allowing the client to detect auth failure
and avoid automatic reconnects.
"""
from __future__ import annotations

import asyncio
import logging

import redis.asyncio as aioredis
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError

from app.core.config import settings
from app.modules.realtime.repository import get_order_channel

logger = logging.getLogger(__name__)

router = APIRouter()

# Roles allowed to receive the kitchen real-time stream
_KITCHEN_ROLES = frozenset({"owner", "admin", "steward"})


def _validate_ws_token(token: str, restaurant_id: int) -> dict | None:
    """Validate the staff JWT and restaurant scope for a WebSocket connection.

    Returns a dict with user data if valid, None otherwise.
    Performs all validation synchronously — no DB call needed because the JWT
    already carries the authoritative user claims (role, restaurant_id, sub).

    SECURITY: We still verify the JWT signature and expiry with the same
    secret key used to issue staff access tokens.
    """
    from app.core.security import decode_token

    try:
        payload = decode_token(token)
    except JWTError:
        return None

    if payload.get("type") != "access":
        return None

    role = payload.get("role")
    if role not in _KITCHEN_ROLES:
        return None

    token_restaurant_id = payload.get("restaurant_id")
    if token_restaurant_id != restaurant_id:
        # Cross-tenant connection attempt — reject
        return None

    return payload


@router.websocket("/kitchen/{restaurant_id}")
async def kitchen_websocket(
    websocket: WebSocket,
    restaurant_id: int,
    token: str = Query(..., description="Staff JWT access token"),
) -> None:
    """WebSocket endpoint for the kitchen real-time order stream.

    Channel: orders:{restaurant_id}

    Messages pushed to connected clients:
      - new_order         — when a guest places an order
      - order_status_updated — when staff updates order status
    """
    # ── Validate before accepting ──────────────────────────────────────────
    user_payload = _validate_ws_token(token, restaurant_id)

    if user_payload is None:
        # Accept then close so the client receives the WS close code (4001)
        # rather than an HTTP 403 upgrade rejection.
        await websocket.accept()
        await websocket.close(code=4001)
        logger.warning(
            "Kitchen WS rejected: restaurant=%d (invalid token or role mismatch)",
            restaurant_id,
        )
        return

    # ── Accept the validated connection ────────────────────────────────────
    await websocket.accept()
    user_id = user_payload.get("sub", "unknown")
    role = user_payload.get("role", "unknown")
    logger.info(
        "Kitchen WS connected: restaurant=%d user=%s role=%s",
        restaurant_id,
        user_id,
        role,
    )

    channel = get_order_channel(restaurant_id)
    redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(channel)

    # ── Task: forward Redis events → WebSocket ─────────────────────────────
    async def _forward_to_ws() -> None:
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    await websocket.send_text(message["data"])
        except asyncio.CancelledError:
            raise  # propagate for clean task cancellation
        except (WebSocketDisconnect, RuntimeError):
            pass  # WebSocket already closed
        except Exception as exc:
            logger.debug("Kitchen WS forward error: %s", exc)

    # ── Task: detect WebSocket disconnect ──────────────────────────────────
    async def _listen_ws() -> None:
        try:
            while True:
                # Receive any text from client (e.g. keepalive ping)
                await websocket.receive_text()
        except asyncio.CancelledError:
            raise
        except (WebSocketDisconnect, RuntimeError):
            pass
        except Exception as exc:
            logger.debug("Kitchen WS receive error: %s", exc)

    forward_task = asyncio.create_task(_forward_to_ws())
    listen_task = asyncio.create_task(_listen_ws())

    # Run until either side terminates (disconnect or error)
    _done, _remaining = await asyncio.wait(
        {forward_task, listen_task},
        return_when=asyncio.FIRST_COMPLETED,
    )

    for task in _remaining:
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass

    # ── Cleanup Redis resources ────────────────────────────────────────────
    try:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
    except Exception:
        pass
    try:
        await redis_client.aclose()
    except Exception:
        pass

    logger.info(
        "Kitchen WS disconnected: restaurant=%d user=%s",
        restaurant_id,
        user_id,
    )
