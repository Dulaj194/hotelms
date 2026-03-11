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
