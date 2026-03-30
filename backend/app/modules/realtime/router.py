"""Real-time router - WebSocket endpoint for the kitchen dashboard.

Authentication strategy
-----------------------
JWT is passed as a query parameter:
    WS /api/v1/ws/kitchen/{restaurant_id}?token=<access_jwt>

This is the most practical approach for browser WebSocket clients because
the native WebSocket API does not support custom HTTP headers.

Security checks (validated before the connection is accepted):
1. JWT signature and expiry are verified.
2. Token type must be "access" (not guest_session / refresh).
3. User is loaded from DB by token subject (sub).
4. User account must be active and must not require password change.
5. User role must be: owner | admin | steward.
6. user.restaurant_id must match the path restaurant_id.
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
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_token
from app.db.session import SessionLocal
from app.modules.realtime.repository import get_order_channel
from app.modules.users.repository import get_by_id_global

logger = logging.getLogger(__name__)

router = APIRouter()

# Roles allowed to receive the kitchen real-time stream
_KITCHEN_ROLES = frozenset({"owner", "admin", "steward"})

# Close code 4001 = auth rejection for this endpoint.
_WS_CODE_UNAUTHORIZED = 4001

# Re-check user access during long-lived WebSocket connections.
_USER_STATE_RECHECK_SECONDS = 30


def _safe_int(value: object) -> int | None:
    """Convert an arbitrary value to int, returning None on failure."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _user_can_access_kitchen_stream(user: object, restaurant_id: int) -> bool:
    """Return True when DB-backed user state allows kitchen WS access."""
    if user is None:
        return False

    is_active = bool(getattr(user, "is_active", False))
    must_change_password = bool(getattr(user, "must_change_password", False))
    user_restaurant_id = getattr(user, "restaurant_id", None)

    role_obj = getattr(user, "role", None)
    role = role_obj.value if hasattr(role_obj, "value") else str(role_obj)

    if not is_active:
        return False
    if must_change_password:
        return False
    if role not in _KITCHEN_ROLES:
        return False
    if user_restaurant_id != restaurant_id:
        return False

    return True


def _validate_ws_token(token: str, restaurant_id: int, db: Session) -> dict | None:
    """Validate WebSocket auth using JWT plus DB-backed user state.

    Returns:
      {"user_id": int, "role": str} on success, otherwise None.

    SECURITY: JWT claims are not treated as authoritative tenant state.
    We resolve user status and tenant linkage from the database.
    """
    try:
        payload = decode_token(token)
    except JWTError:
        return None

    if payload.get("type") != "access":
        return None

    user_id = _safe_int(payload.get("sub"))
    if user_id is None:
        return None

    try:
        user = get_by_id_global(db, user_id)
    except Exception:
        # Fail closed if DB lookup fails.
        return None

    if user is None:
        return None

    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    if not _user_can_access_kitchen_stream(user, restaurant_id):
        return None

    # Defense in depth: reject stale tokens if role/tenant claim mismatches DB.
    token_role = payload.get("role")
    if token_role is not None and token_role != role:
        return None

    token_restaurant_id = payload.get("restaurant_id")
    if token_restaurant_id is not None and token_restaurant_id != restaurant_id:
        return None

    return {"user_id": user.id, "role": role}


def _authenticate_kitchen_ws(token: str, restaurant_id: int) -> dict | None:
    """Run WebSocket auth in a short-lived DB session."""
    db = SessionLocal()
    try:
        return _validate_ws_token(token, restaurant_id, db)
    finally:
        db.close()


def _is_ws_user_access_valid(user_id: int, restaurant_id: int) -> bool:
    """Re-validate DB user state for existing WebSocket sessions."""
    db = SessionLocal()
    try:
        user = get_by_id_global(db, user_id)
        return _user_can_access_kitchen_stream(user, restaurant_id)
    except Exception:
        # Fail closed on DB failures.
        return False
    finally:
        db.close()


@router.websocket("/kitchen/{restaurant_id}")
async def kitchen_websocket(
    websocket: WebSocket,
    restaurant_id: int,
    token: str = Query(..., description="Staff JWT access token"),
) -> None:
    """WebSocket endpoint for the kitchen real-time order stream.

    Channel: orders:{restaurant_id}

    Messages pushed to connected clients:
      - new_order
      - order_status_updated
    """
    # Validate before accepting.
    user_payload = _authenticate_kitchen_ws(token, restaurant_id)

    if user_payload is None:
        # Accept then close so the client receives close code 4001
        # rather than an HTTP 403 upgrade rejection.
        await websocket.accept()
        await websocket.close(code=_WS_CODE_UNAUTHORIZED)
        logger.warning(
            "Kitchen WS rejected: restaurant=%d (invalid token, user state, or tenant scope)",
            restaurant_id,
        )
        return

    # Accept the validated connection.
    await websocket.accept()
    user_id = _safe_int(user_payload.get("user_id"))
    if user_id is None:
        await websocket.close(code=_WS_CODE_UNAUTHORIZED)
        logger.warning(
            "Kitchen WS rejected post-auth: restaurant=%d (missing user id payload)",
            restaurant_id,
        )
        return
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

    async def _forward_to_ws() -> None:
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    await websocket.send_text(message["data"])
        except asyncio.CancelledError:
            raise
        except (WebSocketDisconnect, RuntimeError):
            pass
        except Exception as exc:
            logger.debug("Kitchen WS forward error: %s", exc)

    async def _listen_ws() -> None:
        try:
            while True:
                # Receive any text from client (for example keepalive ping).
                await websocket.receive_text()
        except asyncio.CancelledError:
            raise
        except (WebSocketDisconnect, RuntimeError):
            pass
        except Exception as exc:
            logger.debug("Kitchen WS receive error: %s", exc)

    async def _monitor_user_state() -> None:
        """Continuously enforce DB-backed access state for active WS sessions."""
        try:
            while True:
                await asyncio.sleep(_USER_STATE_RECHECK_SECONDS)
                if not _is_ws_user_access_valid(user_id, restaurant_id):
                    logger.warning(
                        "Kitchen WS revoked: restaurant=%d user=%s (state changed)",
                        restaurant_id,
                        user_id,
                    )
                    try:
                        await websocket.close(code=_WS_CODE_UNAUTHORIZED)
                    except Exception:
                        pass
                    return
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.debug("Kitchen WS user-state monitor error: %s", exc)
            try:
                await websocket.close(code=_WS_CODE_UNAUTHORIZED)
            except Exception:
                pass

    forward_task = asyncio.create_task(_forward_to_ws())
    listen_task = asyncio.create_task(_listen_ws())
    monitor_task = asyncio.create_task(_monitor_user_state())

    # Run until either side terminates (disconnect or error).
    _done, _remaining = await asyncio.wait(
        {forward_task, listen_task, monitor_task},
        return_when=asyncio.FIRST_COMPLETED,
    )

    for task in _remaining:
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass

    # Cleanup Redis resources.
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
