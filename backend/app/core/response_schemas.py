"""Standardized API response schemas for consistent client-server communication."""
from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiResponse(BaseModel):
    """Standard API response wrapper for all endpoints.
    
    Provides consistent response structure with success/error handling.
    
    Example:
        {
            "success": true,
            "data": {...},
            "message": "Resource created successfully"
        }
    """
    success: bool = Field(..., description="Whether the request was successful")
    data: Optional[Any] = Field(None, description="Response payload (null if error)")
    message: str = Field(..., description="Human-readable message")
    error_code: Optional[str] = Field(None, description="Machine-readable error code")
    timestamp: str = Field(..., description="ISO 8601 timestamp of response")
    request_id: Optional[str] = Field(None, description="Unique request identifier for tracking")


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard paginated response for list endpoints.
    
    Example:
        {
            "items": [...],
            "total": 100,
            "page": 1,
            "page_size": 20,
            "total_pages": 5,
            "has_next": true,
            "has_previous": false
        }
    """
    items: list[T] = Field(..., description="List of items in current page")
    total: int = Field(..., description="Total count of all items")
    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Number of items per page")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there is a next page")
    has_previous: bool = Field(..., description="Whether there is a previous page")


class ErrorResponse(BaseModel):
    """Standard error response format.
    
    Example:
        {
            "success": false,
            "message": "Validation failed",
            "error_code": "VALIDATION_ERROR",
            "errors": [
                {"field": "email", "message": "Invalid email format"}
            ]
        }
    """
    success: bool = Field(default=False, description="Always false for errors")
    message: str = Field(..., description="Error message")
    error_code: str = Field(..., description="Machine-readable error code")
    errors: Optional[list[dict[str, Any]]] = Field(None, description="Field-level validation errors")
    timestamp: str = Field(..., description="ISO 8601 timestamp of error")
    request_id: Optional[str] = Field(None, description="Unique request identifier for tracking")


class ValidationErrorDetail(BaseModel):
    """Field-level validation error details."""
    field: str = Field(..., description="Field name that failed validation")
    message: str = Field(..., description="Validation error message")
    value: Optional[Any] = Field(None, description="Value that was rejected")


class HealthCheckResponse(BaseModel):
    """Health check response for service status."""
    status: str = Field(..., description="Service status (ok, degraded, unhealthy)")
    version: str = Field(..., description="API version")
    timestamp: str = Field(..., description="ISO 8601 timestamp")
    checks: dict[str, str] = Field(..., description="Status of individual components (db, redis, etc)")
