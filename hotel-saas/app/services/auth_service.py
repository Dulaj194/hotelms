"""
Authentication service.
Implements tenant-first auth flow, then super admin auth.
"""

from __future__ import annotations

from typing import Optional, Sequence

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.constants import (
    ROLE_ADMIN,
    ROLE_HOUSEKEEPER,
    ROLE_OWNER,
    ROLE_STEWARD,
    ROLE_SUPER_ADMIN,
)
from app.core.password import PasswordService
from app.core.security import (
    PRINCIPAL_TYPE_ADMIN,
    PRINCIPAL_TYPE_RESTAURANT,
    PRINCIPAL_TYPE_SUPER_ADMIN,
    TOKEN_TYPE_REFRESH,
    JWTService,
    TokenDenylistService,
    TokenPayload,
)
from app.core.settings import settings
from app.dependencies.auth import AuthenticatedUser
from app.models import Admin, Restaurant, SuperAdmin
from app.repositories.admin import AdminRepository
from app.repositories.restaurant import RestaurantRepository
from app.repositories.super_admin import SuperAdminRepository
from app.schemas.auth import (
    AuthUserResponse,
    LoginResponse,
    LogoutResponse,
    TokenBundleResponse,
)

TENANT_ADMIN_ROLES: Sequence[str] = (ROLE_OWNER, ROLE_ADMIN)
STAFF_ROLES: Sequence[str] = (ROLE_STEWARD, ROLE_HOUSEKEEPER)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _invalid_credentials_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
    )


def _inactive_account_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Account is inactive",
    )


def _access_expires_in_seconds() -> int:
    return settings.jwt_access_token_expire_minutes * 60


def _refresh_expires_in_seconds() -> int:
    return settings.jwt_refresh_token_expire_days * 24 * 60 * 60


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.admin_repo = AdminRepository(db)
        self.restaurant_repo = RestaurantRepository(db)
        self.super_admin_repo = SuperAdminRepository(db)

    # ------------------------------------------------------------------
    # Main auth flow
    # 1) restaurant/admin login
    # 2) staff login
    # ------------------------------------------------------------------

    def login_restaurant_admin(
        self,
        *,
        email: str,
        password: str,
        restaurant_id: Optional[int] = None,
    ) -> LoginResponse:
        """
        Restaurant/Admin login endpoint.
        Supports:
        - restaurant_tbl account (treated as tenant owner-level principal)
        - admin_tbl roles: owner/admin
        """
        normalized_email = _normalize_email(email)

        restaurant = self.restaurant_repo.find_by_email(normalized_email)
        if restaurant and self._restaurant_login_allowed(restaurant, restaurant_id):
            if not PasswordService.verify(password, restaurant.password):
                raise _invalid_credentials_error()
            if not restaurant.is_active:
                raise _inactive_account_error()

            subject = TokenPayload(
                sub=restaurant.restaurant_id,
                email=restaurant.email,
                role=ROLE_OWNER,
                principal_type=PRINCIPAL_TYPE_RESTAURANT,
                restaurant_id=restaurant.restaurant_id,
            )
            user = AuthUserResponse(
                user_id=restaurant.restaurant_id,
                principal_type=PRINCIPAL_TYPE_RESTAURANT,
                name=restaurant.restaurant_name,
                email=restaurant.email,
                role=ROLE_OWNER,
                restaurant_id=restaurant.restaurant_id,
                is_active=bool(restaurant.is_active),
            )
            return self._build_login_response(subject, user)

        admin = self._find_admin_for_login(normalized_email, restaurant_id)
        if not admin:
            raise _invalid_credentials_error()
        if admin.role.value in STAFF_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Staff accounts must use /api/v1/auth/login/staff",
            )
        if admin.role.value not in TENANT_ADMIN_ROLES:
            raise _invalid_credentials_error()
        if not PasswordService.verify(password, admin.password):
            raise _invalid_credentials_error()
        if not admin.is_active:
            raise _inactive_account_error()

        subject = TokenPayload(
            sub=admin.admin_id,
            email=admin.email,
            role=admin.role.value,
            principal_type=PRINCIPAL_TYPE_ADMIN,
            restaurant_id=admin.restaurant_id,
        )
        user = AuthUserResponse(
            user_id=admin.admin_id,
            principal_type=PRINCIPAL_TYPE_ADMIN,
            name=admin.name,
            email=admin.email,
            role=admin.role.value,
            restaurant_id=admin.restaurant_id,
            is_active=bool(admin.is_active),
        )
        return self._build_login_response(subject, user)

    def login_staff(
        self,
        *,
        email: str,
        password: str,
        restaurant_id: Optional[int] = None,
    ) -> LoginResponse:
        """Staff login endpoint for steward/housekeeper."""
        normalized_email = _normalize_email(email)
        admin = self._find_admin_for_login(normalized_email, restaurant_id)
        if not admin:
            raise _invalid_credentials_error()
        if admin.role.value in TENANT_ADMIN_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Owner/admin accounts must use /api/v1/auth/login/restaurant-admin",
            )
        if admin.role.value not in STAFF_ROLES:
            raise _invalid_credentials_error()
        if not PasswordService.verify(password, admin.password):
            raise _invalid_credentials_error()
        if not admin.is_active:
            raise _inactive_account_error()

        subject = TokenPayload(
            sub=admin.admin_id,
            email=admin.email,
            role=admin.role.value,
            principal_type=PRINCIPAL_TYPE_ADMIN,
            restaurant_id=admin.restaurant_id,
        )
        user = AuthUserResponse(
            user_id=admin.admin_id,
            principal_type=PRINCIPAL_TYPE_ADMIN,
            name=admin.name,
            email=admin.email,
            role=admin.role.value,
            restaurant_id=admin.restaurant_id,
            is_active=bool(admin.is_active),
        )
        return self._build_login_response(subject, user)

    # ------------------------------------------------------------------
    # Token flow
    # 1) refresh token
    # 2) logout
    # 3) /auth/me
    # ------------------------------------------------------------------

    def refresh_tokens(self, *, refresh_token: str) -> TokenBundleResponse:
        try:
            claims = JWTService.extract_claims(refresh_token)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(exc),
            ) from exc

        if claims.token_type != TOKEN_TYPE_REFRESH:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )

        if TokenDenylistService.is_revoked(claims.jti):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has been revoked",
            )

        current_user = self._resolve_user_from_claims(claims)

        # Rotate refresh token: revoke old JTI before issuing new one.
        TokenDenylistService.revoke(claims.jti, claims.exp)

        subject = TokenPayload(
            sub=current_user.user_id,
            email=current_user.email,
            role=current_user.role,
            principal_type=current_user.principal_type,
            restaurant_id=current_user.restaurant_id,
        )
        return self._build_token_bundle(subject)

    def logout(
        self,
        *,
        current_user: AuthenticatedUser,
        refresh_token: Optional[str] = None,
    ) -> LogoutResponse:
        # Revoke currently used access token.
        TokenDenylistService.revoke(current_user.token_jti, current_user.token_exp)

        # Optional refresh token revoke.
        if refresh_token:
            try:
                refresh_claims = JWTService.extract_claims(refresh_token)
            except ValueError:
                refresh_claims = None

            if (
                refresh_claims is not None
                and refresh_claims.token_type == TOKEN_TYPE_REFRESH
                and refresh_claims.sub == current_user.user_id
                and refresh_claims.principal_type == current_user.principal_type
            ):
                TokenDenylistService.revoke(refresh_claims.jti, refresh_claims.exp)

        return LogoutResponse()

    @staticmethod
    def me(current_user: AuthenticatedUser) -> AuthUserResponse:
        return AuthUserResponse(
            user_id=current_user.user_id,
            principal_type=current_user.principal_type,
            name=current_user.name,
            email=current_user.email,
            role=current_user.role,
            restaurant_id=current_user.restaurant_id,
            is_active=current_user.is_active,
        )

    # ------------------------------------------------------------------
    # SuperAdmin login (intentionally placed after main tenant auth flow)
    # ------------------------------------------------------------------

    def login_super_admin(
        self,
        *,
        email: str,
        password: str,
    ) -> LoginResponse:
        normalized_email = _normalize_email(email)
        super_admin = self.super_admin_repo.find_by_email(normalized_email)
        if not super_admin:
            raise _invalid_credentials_error()
        if not PasswordService.verify(password, super_admin.password):
            raise _invalid_credentials_error()
        if not super_admin.is_active:
            raise _inactive_account_error()

        subject = TokenPayload(
            sub=super_admin.super_admin_id,
            email=super_admin.email,
            role=ROLE_SUPER_ADMIN,
            principal_type=PRINCIPAL_TYPE_SUPER_ADMIN,
            restaurant_id=None,
        )
        user = AuthUserResponse(
            user_id=super_admin.super_admin_id,
            principal_type=PRINCIPAL_TYPE_SUPER_ADMIN,
            name=super_admin.name,
            email=super_admin.email,
            role=ROLE_SUPER_ADMIN,
            restaurant_id=None,
            is_active=bool(super_admin.is_active),
        )
        return self._build_login_response(subject, user)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _find_admin_for_login(
        self,
        email: str,
        restaurant_id: Optional[int],
    ) -> Optional[Admin]:
        if restaurant_id:
            return self.admin_repo.find_by_email_in_restaurant(email, restaurant_id)
        return self.admin_repo.find_by_email(email)

    @staticmethod
    def _restaurant_login_allowed(
        restaurant: Restaurant,
        expected_restaurant_id: Optional[int],
    ) -> bool:
        if expected_restaurant_id is None:
            return True
        return restaurant.restaurant_id == expected_restaurant_id

    def _resolve_user_from_claims(self, claims: TokenPayload) -> AuthenticatedUser:
        if claims.principal_type == PRINCIPAL_TYPE_SUPER_ADMIN:
            user = self.db.query(SuperAdmin).filter(
                SuperAdmin.super_admin_id == claims.sub
            ).first()
            if not user:
                raise _invalid_credentials_error()
            if not user.is_active:
                raise _inactive_account_error()
            if claims.role != ROLE_SUPER_ADMIN:
                raise _invalid_credentials_error()
            if claims.restaurant_id is not None:
                raise _invalid_credentials_error()
            return AuthenticatedUser(
                user_id=user.super_admin_id,
                principal_type=PRINCIPAL_TYPE_SUPER_ADMIN,
                name=user.name,
                email=user.email,
                role=ROLE_SUPER_ADMIN,
                restaurant_id=None,
                is_active=True,
                token_jti=claims.jti,
                token_exp=claims.exp,
            )

        if claims.principal_type == PRINCIPAL_TYPE_RESTAURANT:
            user = self.db.query(Restaurant).filter(
                Restaurant.restaurant_id == claims.sub
            ).first()
            if not user:
                raise _invalid_credentials_error()
            if not user.is_active:
                raise _inactive_account_error()
            if claims.restaurant_id != user.restaurant_id:
                raise _invalid_credentials_error()
            return AuthenticatedUser(
                user_id=user.restaurant_id,
                principal_type=PRINCIPAL_TYPE_RESTAURANT,
                name=user.restaurant_name,
                email=user.email,
                role=claims.role,
                restaurant_id=user.restaurant_id,
                is_active=True,
                token_jti=claims.jti,
                token_exp=claims.exp,
            )

        if claims.principal_type == PRINCIPAL_TYPE_ADMIN:
            user = self.db.query(Admin).filter(Admin.admin_id == claims.sub).first()
            if not user:
                raise _invalid_credentials_error()
            if not user.is_active:
                raise _inactive_account_error()
            if claims.restaurant_id != user.restaurant_id:
                raise _invalid_credentials_error()
            if claims.role != user.role.value:
                raise _invalid_credentials_error()
            return AuthenticatedUser(
                user_id=user.admin_id,
                principal_type=PRINCIPAL_TYPE_ADMIN,
                name=user.name,
                email=user.email,
                role=user.role.value,
                restaurant_id=user.restaurant_id,
                is_active=True,
                token_jti=claims.jti,
                token_exp=claims.exp,
            )

        raise _invalid_credentials_error()

    @staticmethod
    def _build_token_bundle(subject: TokenPayload) -> TokenBundleResponse:
        access_token = JWTService.generate_access_token(subject)
        refresh_token = JWTService.generate_refresh_token(subject)
        return TokenBundleResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=_access_expires_in_seconds(),
            refresh_expires_in=_refresh_expires_in_seconds(),
        )

    def _build_login_response(
        self,
        subject: TokenPayload,
        user: AuthUserResponse,
    ) -> LoginResponse:
        token_bundle = self._build_token_bundle(subject)
        return LoginResponse(user=user, tokens=token_bundle)
