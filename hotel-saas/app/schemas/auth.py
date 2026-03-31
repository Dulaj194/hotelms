"""
Authentication request/response schemas.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=255)
    restaurant_id: Optional[int] = Field(default=None, ge=1)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20)


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = Field(default=None, min_length=20)


class AuthUserResponse(BaseModel):
    user_id: int
    principal_type: str
    name: str
    email: EmailStr
    role: str
    restaurant_id: Optional[int] = None
    is_active: bool


class TokenBundleResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_expires_in: int


class LoginResponse(BaseModel):
    user: AuthUserResponse
    tokens: TokenBundleResponse


class LogoutResponse(BaseModel):
    success: bool = True
    message: str = "Logged out successfully"
