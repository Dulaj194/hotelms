"""
Authentication routes.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import AuthenticatedUser, get_current_user
from app.schemas.auth import (
    AuthUserResponse,
    LoginRequest,
    LoginResponse,
    LogoutRequest,
    LogoutResponse,
    RefreshRequest,
    TokenBundleResponse,
)
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/login/restaurant-admin", response_model=LoginResponse)
def login_restaurant_admin(
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> LoginResponse:
    service = AuthService(db)
    return service.login_restaurant_admin(
        email=str(payload.email),
        password=payload.password,
        restaurant_id=payload.restaurant_id,
    )


@router.post("/login/staff", response_model=LoginResponse)
def login_staff(
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> LoginResponse:
    service = AuthService(db)
    return service.login_staff(
        email=str(payload.email),
        password=payload.password,
        restaurant_id=payload.restaurant_id,
    )


@router.post("/refresh", response_model=TokenBundleResponse)
def refresh_tokens(
    payload: RefreshRequest,
    db: Session = Depends(get_db),
) -> TokenBundleResponse:
    service = AuthService(db)
    return service.refresh_tokens(refresh_token=payload.refresh_token)


@router.post("/logout", response_model=LogoutResponse)
def logout(
    payload: LogoutRequest | None = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LogoutResponse:
    service = AuthService(db)
    return service.logout(
        current_user=current_user,
        refresh_token=payload.refresh_token if payload else None,
    )


@router.get("/me", response_model=AuthUserResponse)
def get_me(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthUserResponse:
    return AuthService.me(current_user)


@router.post("/login/super-admin", response_model=LoginResponse)
def login_super_admin(
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> LoginResponse:
    service = AuthService(db)
    return service.login_super_admin(
        email=str(payload.email),
        password=payload.password,
    )
