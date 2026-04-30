"""Response building utilities for standardized API responses."""
from datetime import datetime, timezone
from typing import Any, Optional
import uuid

from app.core.response_schemas import ApiResponse, ErrorResponse, PaginatedResponse


def get_timestamp() -> str:
    """Get current timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


def get_request_id() -> str:
    """Generate a unique request ID."""
    return str(uuid.uuid4())


def success_response(
    data: Any,
    message: str = "Success",
    request_id: Optional[str] = None,
) -> ApiResponse:
    """Build a successful API response.
    
    Args:
        data: Response payload
        message: Human-readable message
        request_id: Optional request ID for tracking
        
    Returns:
        Standardized success response
    """
    return ApiResponse(
        success=True,
        data=data,
        message=message,
        timestamp=get_timestamp(),
        request_id=request_id or get_request_id(),
    )


def error_response(
    message: str,
    error_code: str,
    errors: Optional[list[dict[str, Any]]] = None,
    request_id: Optional[str] = None,
) -> ErrorResponse:
    """Build an error API response.
    
    Args:
        message: Error message
        error_code: Machine-readable error code
        errors: Field-level validation errors
        request_id: Optional request ID for tracking
        
    Returns:
        Standardized error response
    """
    return ErrorResponse(
        success=False,
        message=message,
        error_code=error_code,
        errors=errors,
        timestamp=get_timestamp(),
        request_id=request_id or get_request_id(),
    )


def paginated_response(
    items: list[Any],
    total: int,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    """Build a paginated response.
    
    Args:
        items: List of items for current page
        total: Total count of all items
        page: Current page number (1-indexed)
        page_size: Number of items per page
        
    Returns:
        Paginated response data
    """
    total_pages = (total + page_size - 1) // page_size
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_previous": page > 1,
    }
