"""
JWT Authentication and Token Management.
"""

from __future__ import annotations

import threading
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

import jwt
from pydantic import BaseModel, model_validator

from app.core.constants import ROLE_SUPER_ADMIN, VALID_ROLES
from app.core.settings import settings

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"
VALID_TOKEN_TYPES = {TOKEN_TYPE_ACCESS, TOKEN_TYPE_REFRESH}

PRINCIPAL_TYPE_RESTAURANT = "restaurant"
PRINCIPAL_TYPE_ADMIN = "admin"
PRINCIPAL_TYPE_SUPER_ADMIN = "super_admin"
VALID_PRINCIPAL_TYPES = {
    PRINCIPAL_TYPE_RESTAURANT,
    PRINCIPAL_TYPE_ADMIN,
    PRINCIPAL_TYPE_SUPER_ADMIN,
}


class TokenPayload(BaseModel):
    """Normalized JWT payload contract."""

    sub: int
    email: str
    role: str
    principal_type: str
    restaurant_id: Optional[int] = None
    token_type: str = TOKEN_TYPE_ACCESS
    jti: Optional[str] = None
    iat: Optional[int] = None
    exp: Optional[int] = None

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def validate_payload(self) -> "TokenPayload":
        if self.role not in VALID_ROLES:
            raise ValueError(f"Unsupported role: {self.role}")

        if self.principal_type not in VALID_PRINCIPAL_TYPES:
            raise ValueError(f"Unsupported principal_type: {self.principal_type}")

        if self.token_type not in VALID_TOKEN_TYPES:
            raise ValueError(f"Unsupported token type: {self.token_type}")

        if self.sub <= 0:
            raise ValueError("sub must be a positive integer")

        # Tenant payloads must carry restaurant context.
        if self.role != ROLE_SUPER_ADMIN:
            if self.restaurant_id is None or self.restaurant_id <= 0:
                raise ValueError("restaurant_id is required for tenant users")
        else:
            # Platform user must not carry tenant context.
            if self.restaurant_id is not None:
                raise ValueError("super_admin token must not include restaurant_id")
            if self.principal_type != PRINCIPAL_TYPE_SUPER_ADMIN:
                raise ValueError("super_admin role requires principal_type=super_admin")

        return self

    def to_dict(self) -> Dict[str, Any]:
        """Convert payload to JWT claim dictionary."""
        data: Dict[str, Any] = {
            "sub": self.sub,
            "email": self.email,
            "role": self.role,
            "principal_type": self.principal_type,
            "type": self.token_type,
        }

        if self.restaurant_id is not None:
            data["restaurant_id"] = self.restaurant_id
        if self.jti is not None:
            data["jti"] = self.jti
        if self.iat is not None:
            data["iat"] = self.iat
        if self.exp is not None:
            data["exp"] = self.exp

        return data


class TokenData(TokenPayload):
    """
    Backward-compatible alias.
    Prefer using TokenPayload directly.
    """


class JWTService:
    """JWT token creation and decoding."""

    @staticmethod
    def generate_access_token(
        payload: TokenData | TokenPayload | Dict[str, Any],
        expires_delta: Optional[timedelta] = None,
    ) -> str:
        if expires_delta is None:
            expires_delta = timedelta(minutes=settings.jwt_access_token_expire_minutes)
        return JWTService._encode_token(payload, expires_delta, TOKEN_TYPE_ACCESS)

    @staticmethod
    def generate_refresh_token(
        payload: TokenData | TokenPayload | Dict[str, Any],
        expires_delta: Optional[timedelta] = None,
    ) -> str:
        if expires_delta is None:
            expires_delta = timedelta(days=settings.jwt_refresh_token_expire_days)
        return JWTService._encode_token(payload, expires_delta, TOKEN_TYPE_REFRESH)

    @staticmethod
    def _encode_token(
        payload: TokenData | TokenPayload | Dict[str, Any],
        expires_delta: timedelta,
        token_type: str,
    ) -> str:
        if isinstance(payload, (TokenData, TokenPayload)):
            base_payload = payload.model_copy(update={"token_type": token_type})
        else:
            base_payload = TokenPayload(
                sub=int(payload["sub"]),
                email=str(payload["email"]),
                role=str(payload["role"]),
                principal_type=str(payload["principal_type"]),
                restaurant_id=payload.get("restaurant_id"),
                token_type=token_type,
                jti=payload.get("jti"),
            )

        now = datetime.now(timezone.utc)
        claims = base_payload.model_copy(
            update={
                "token_type": token_type,
                "jti": base_payload.jti or str(uuid4()),
                "iat": int(now.timestamp()),
                "exp": int((now + expires_delta).timestamp()),
            }
        )

        return jwt.encode(
            claims.to_dict(),
            settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
        )

    @staticmethod
    def decode(token: str) -> Dict[str, Any]:
        try:
            return jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=[settings.jwt_algorithm],
            )
        except jwt.ExpiredSignatureError as exc:
            raise ValueError("Token has expired") from exc
        except jwt.InvalidSignatureError as exc:
            raise ValueError("Invalid token signature") from exc
        except jwt.InvalidTokenError as exc:
            raise ValueError(f"Invalid token: {str(exc)}") from exc

    @staticmethod
    def verify_token(token: str) -> Optional[Dict[str, Any]]:
        try:
            return JWTService.decode(token)
        except ValueError:
            return None

    @staticmethod
    def get_token_from_header(authorization: Optional[str]) -> Optional[str]:
        if not authorization:
            return None

        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None
        return parts[1]

    @staticmethod
    def extract_claims(token: str) -> TokenPayload:
        payload = JWTService.decode(token)
        try:
            return TokenPayload(
                sub=int(payload["sub"]),
                email=str(payload["email"]),
                role=str(payload["role"]),
                principal_type=str(payload["principal_type"]),
                restaurant_id=payload.get("restaurant_id"),
                token_type=payload.get("type", TOKEN_TYPE_ACCESS),
                jti=payload.get("jti"),
                iat=payload.get("iat"),
                exp=payload.get("exp"),
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError("Token payload is missing required claims") from exc


class TokenDenylistService:
    """
    In-memory revoked token store keyed by jti.
    This is process-local and should be replaced by Redis/DB for distributed deployments.
    """

    _lock = threading.Lock()
    _revoked_until_by_jti: Dict[str, int] = {}

    @classmethod
    def revoke(cls, jti: Optional[str], expires_at: Optional[int]) -> None:
        if not jti or not expires_at:
            return

        now_ts = int(datetime.now(timezone.utc).timestamp())
        if expires_at <= now_ts:
            return

        with cls._lock:
            cls._revoked_until_by_jti[jti] = expires_at
            cls._cleanup_locked(now_ts)

    @classmethod
    def is_revoked(cls, jti: Optional[str]) -> bool:
        if not jti:
            return False

        now_ts = int(datetime.now(timezone.utc).timestamp())
        with cls._lock:
            cls._cleanup_locked(now_ts)
            expires_at = cls._revoked_until_by_jti.get(jti)
            return expires_at is not None and expires_at > now_ts

    @classmethod
    def _cleanup_locked(cls, now_ts: int) -> None:
        expired_keys = [
            token_jti
            for token_jti, expires_at in cls._revoked_until_by_jti.items()
            if expires_at <= now_ts
        ]
        for token_jti in expired_keys:
            cls._revoked_until_by_jti.pop(token_jti, None)
