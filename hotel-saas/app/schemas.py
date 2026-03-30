"""
Pydantic Schemas
Request/response validation models
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# Token Schemas
class TokenData(BaseModel):
    """JWT token payload"""

    sub: int  # User ID
    restaurant_id: Optional[int] = None  # Tenant context
    role: str
    email: Optional[str] = None
    type: str = "access"


class TokenResponse(BaseModel):
    """Token response"""

    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int


# Auth Schemas
class LoginRequest(BaseModel):
    """Login request"""

    email: EmailStr
    password: str = Field(min_length=8, max_length=255)


class LoginResponse(BaseModel):
    """Login response"""

    user_id: int
    email: str
    role: str
    access_token: str
    refresh_token: Optional[str] = None


# Restaurant Schemas
class RestaurantBase(BaseModel):
    """Base restaurant data"""

    restaurant_name: str = Field(min_length=3, max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    contact_number: Optional[str] = Field(None, regex=r"^\+?[1-9]\d{1,14}$")
    email: EmailStr
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    currency_code: str = "USD"
    timezone: str = "UTC"
    country_code: Optional[str] = None


class RestaurantCreate(RestaurantBase):
    """Create restaurant"""

    password: str = Field(min_length=8, max_length=255)


class RestaurantUpdate(BaseModel):
    """Update restaurant"""

    restaurant_name: Optional[str] = None
    address: Optional[str] = None
    contact_number: Optional[str] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    timezone: Optional[str] = None


class RestaurantResponse(RestaurantBase):
    """Restaurant response"""

    restaurant_id: int
    logo: Optional[str] = None
    subscription_status: str
    subscription_expiry_date: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Admin Schemas
class AdminBase(BaseModel):
    """Base admin data"""

    name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    phone: Optional[str] = None
    role: str = "admin"


class AdminCreate(AdminBase):
    """Create admin"""

    password: str = Field(min_length=8, max_length=255)


class AdminUpdate(BaseModel):
    """Update admin"""

    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None


class AdminResponse(AdminBase):
    """Admin response"""

    admin_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Error Schemas
class ErrorResponse(BaseModel):
    """Error response"""

    success: bool = False
    message: str
    errors: Optional[Dict[str, List[str]]] = None
    trace_id: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None


class ValidationErrorResponse(BaseModel):
    """Validation error response"""

    success: bool = False
    message: str = "Validation failed"
    errors: Dict[str, List[str]]
    meta: Dict[str, Any]


# Pagination
class PaginatedResponse(BaseModel):
    """Paginated response wrapper"""

    success: bool = True
    message: str
    data: List[Any]
    pagination: Dict[str, Any]
    meta: Dict[str, Any]


# Audit Log Schemas
class AuditLogResponse(BaseModel):
    """Audit log response"""

    audit_id: int
    restaurant_id: Optional[int]
    actor_id: int
    actor_role: str
    entity_type: str
    entity_id: int
    action: str
    field_name: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    changed_at: datetime

    class Config:
        from_attributes = True
