import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─── Password helpers ─────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return _pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against its bcrypt hash."""
    return _pwd_context.verify(plain_password, hashed_password)


# ─── JWT helpers ──────────────────────────────────────────────────────────────

def create_access_token(payload: dict) -> str:
    """Create a short-lived JWT access token."""
    data = payload.copy()
    data["exp"] = datetime.now(UTC) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    data["type"] = "access"
    return jwt.encode(data, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(user_id: int, session_id: str) -> str:
    """Create a long-lived JWT refresh token tied to a Redis session."""
    payload = {
        "sub": str(user_id),
        "session_id": session_id,
        "exp": datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
        "type": "refresh",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict:
    """Decode and verify a JWT, raising jose.JWTError on failure."""
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])


# ─── Secure token helpers ─────────────────────────────────────────────────────

def generate_secure_token() -> str:
    """Generate a cryptographically secure URL-safe random token."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Return a SHA-256 hex digest of the token for safe database storage."""
    return hashlib.sha256(token.encode()).hexdigest()


# ─── Guest session token helpers ─────────────────────────────────────────────
#
# Guest tokens use the same secret key + algorithm as staff JWT tokens but
# carry a distinct "type": "guest_session" claim so they can NEVER be
# confused with or accepted in place of staff access tokens.


def create_guest_session_token(
    session_id: str,
    restaurant_id: int,
    table_number: str,
    expire_minutes: int,
) -> str:
    """Create a signed guest table session token.

    Encodes session_id, restaurant_id, table_number, and expiry.
    The type claim is 'guest_session' — intentionally different from
    staff 'access' or 'refresh' tokens.
    """
    payload = {
        "type": "guest_session",
        "session_id": session_id,
        "restaurant_id": restaurant_id,
        "table_number": table_number,
        "exp": datetime.now(UTC) + timedelta(minutes=expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_guest_session_token(token: str) -> dict:
    """Decode and verify a guest session token.

    Raises jose.JWTError on invalid/expired tokens.
    Also raises ValueError if the token type is not 'guest_session',
    preventing staff tokens from being used as guest session credentials.
    """
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    if payload.get("type") != "guest_session":
        raise ValueError("Token type is not guest_session")
    return payload


# ─── Room session token helpers ───────────────────────────────────────────────
#
# Room session tokens use type="room_session" — distinct from both staff tokens
# ("access"/"refresh") and table guest session tokens ("guest_session").
# This prevents cross-use of any token type.


def create_room_session_token(
    session_id: str,
    restaurant_id: int,
    room_id: int,
    room_number: str,
    expire_minutes: int,
) -> str:
    """Create a signed room guest session token.

    Encodes session_id, restaurant_id, room_id, room_number, and expiry.
    The type claim is 'room_session' — cannot be used as a staff or table token.
    """
    payload = {
        "type": "room_session",
        "session_id": session_id,
        "restaurant_id": restaurant_id,
        "room_id": room_id,
        "room_number": room_number,
        "exp": datetime.now(UTC) + timedelta(minutes=expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_room_session_token(token: str) -> dict:
    """Decode and verify a room session token.

    Raises jose.JWTError on invalid/expired tokens.
    Raises ValueError if the token type is not 'room_session'.
    """
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    if payload.get("type") != "room_session":
        raise ValueError("Token type is not room_session")
    return payload


def create_room_qr_access_token(
    *,
    restaurant_id: int,
    room_number: str,
    expire_days: int,
) -> str:
    """Create a signed credential embedded inside room QR URLs.

    This token is not a session token. It only proves that the QR context
    (restaurant + room number) is authentic when starting a room session.
    """
    payload = {
        "type": "room_qr_access",
        "restaurant_id": restaurant_id,
        "room_number": room_number,
        "exp": datetime.now(UTC) + timedelta(days=expire_days),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_room_qr_access_token(token: str) -> dict:
    """Decode and verify a room QR access token."""
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    if payload.get("type") != "room_qr_access":
        raise ValueError("Token type is not room_qr_access")
    return payload
