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
