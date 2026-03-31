"""
Authentication and authorization dependencies.
"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.constants import ROLE_SUPER_ADMIN
from app.core.database import get_db
from app.core.security import (
    PRINCIPAL_TYPE_ADMIN,
    PRINCIPAL_TYPE_RESTAURANT,
    PRINCIPAL_TYPE_SUPER_ADMIN,
    TOKEN_TYPE_ACCESS,
    JWTService,
    TokenDenylistService,
)
from app.models import Admin, Restaurant, SuperAdmin

bearer_scheme = HTTPBearer(auto_error=True)


class AuthenticatedUser(BaseModel):
    """Normalized authenticated principal returned by dependencies."""

    user_id: int
    principal_type: str
    name: str
    email: EmailStr
    role: str
    restaurant_id: Optional[int] = None
    is_active: bool
    token_jti: Optional[str] = None
    token_exp: Optional[int] = None


def _auth_error(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AuthenticatedUser:
    """Resolve access token into a verified user + tenant context."""
    try:
        claims = JWTService.extract_claims(credentials.credentials)
    except ValueError as exc:
        raise _auth_error(str(exc)) from exc

    if claims.token_type != TOKEN_TYPE_ACCESS:
        raise _auth_error("Invalid token type")

    if TokenDenylistService.is_revoked(claims.jti):
        raise _auth_error("Token has been revoked")

    if claims.principal_type == PRINCIPAL_TYPE_SUPER_ADMIN:
        user = db.query(SuperAdmin).filter(
            SuperAdmin.super_admin_id == claims.sub
        ).first()
        if not user:
            raise _auth_error("User not found")
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive",
            )
        if claims.role != ROLE_SUPER_ADMIN:
            raise _auth_error("Invalid super admin role")
        if claims.email.lower() != user.email.lower():
            raise _auth_error("Token email mismatch")

        return AuthenticatedUser(
            user_id=user.super_admin_id,
            principal_type=PRINCIPAL_TYPE_SUPER_ADMIN,
            name=user.name,
            email=user.email,
            role=claims.role,
            restaurant_id=None,
            is_active=bool(user.is_active),
            token_jti=claims.jti,
            token_exp=claims.exp,
        )

    if claims.principal_type == PRINCIPAL_TYPE_RESTAURANT:
        user = db.query(Restaurant).filter(
            Restaurant.restaurant_id == claims.sub
        ).first()
        if not user:
            raise _auth_error("User not found")
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive",
            )
        if claims.restaurant_id != user.restaurant_id:
            raise _auth_error("Tenant context mismatch")
        if claims.email.lower() != user.email.lower():
            raise _auth_error("Token email mismatch")

        return AuthenticatedUser(
            user_id=user.restaurant_id,
            principal_type=PRINCIPAL_TYPE_RESTAURANT,
            name=user.restaurant_name,
            email=user.email,
            role=claims.role,
            restaurant_id=user.restaurant_id,
            is_active=bool(user.is_active),
            token_jti=claims.jti,
            token_exp=claims.exp,
        )

    if claims.principal_type == PRINCIPAL_TYPE_ADMIN:
        user = db.query(Admin).filter(Admin.admin_id == claims.sub).first()
        if not user:
            raise _auth_error("User not found")
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive",
            )
        if claims.restaurant_id != user.restaurant_id:
            raise _auth_error("Tenant context mismatch")
        if claims.role != user.role.value:
            raise _auth_error("Role mismatch")
        if claims.email.lower() != user.email.lower():
            raise _auth_error("Token email mismatch")

        return AuthenticatedUser(
            user_id=user.admin_id,
            principal_type=PRINCIPAL_TYPE_ADMIN,
            name=user.name,
            email=user.email,
            role=user.role.value,
            restaurant_id=user.restaurant_id,
            is_active=bool(user.is_active),
            token_jti=claims.jti,
            token_exp=claims.exp,
        )

    raise _auth_error("Unsupported principal type")


def get_current_restaurant_id(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> int:
    """
    Enforce tenant context.
    Restaurant/staff users must always carry a restaurant_id.
    """
    if current_user.restaurant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant context is required for this endpoint",
        )
    return current_user.restaurant_id


def get_current_restaurant(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> Restaurant:
    """Resolve and validate current tenant restaurant from auth context."""
    restaurant = db.query(Restaurant).filter(
        Restaurant.restaurant_id == restaurant_id
    ).first()
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found",
        )
    if not restaurant.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Restaurant is inactive",
        )
    return restaurant


def require_roles(*allowed_roles: str):
    """Role guard dependency factory."""
    role_set = set(allowed_roles)

    def _checker(
        current_user: AuthenticatedUser = Depends(get_current_user),
    ) -> AuthenticatedUser:
        if current_user.role not in role_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role permissions",
            )
        return current_user

    return _checker
