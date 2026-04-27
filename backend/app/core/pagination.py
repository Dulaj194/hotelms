"""Pagination utilities for consistent pagination across all list endpoints."""
from typing import Generic, TypeVar, Optional

from fastapi import Query
from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationParams(BaseModel):
    """Standard pagination parameters for all list endpoints.
    
    Usage in router:
        @router.get("/items")
        async def list_items(
            pagination: PaginationParams = Depends(),
            db: Session = Depends(get_db),
        ):
            items, total = repository.list_items(
                db, 
                skip=pagination.skip,
                limit=pagination.limit,
            )
            return paginated_response(items, total, pagination.page, pagination.limit)
    """
    page: int = Field(
        default=1,
        ge=1,
        description="Page number (1-indexed)",
        query_alias="page"
    )
    limit: int = Field(
        default=50,
        ge=1,
        le=500,
        description="Items per page (max 500)",
        query_alias="limit"
    )

    @property
    def skip(self) -> int:
        """Calculate offset from page number."""
        return (self.page - 1) * self.limit

    @property
    def offset(self) -> int:
        """Alias for skip (some ORMs use offset, some use skip)."""
        return self.skip


def pagination_depends(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(50, ge=1, le=500, description="Items per page (max 500)"),
) -> PaginationParams:
    """Dependency injection for pagination parameters.
    
    Usage:
        @router.get("/items")
        async def list_items(
            pagination: PaginationParams = Depends(pagination_depends),
        ):
            ...
    """
    return PaginationParams(page=page, limit=limit)


class PaginatedData(BaseModel, Generic[T]):
    """Paginated response containing items and metadata."""
    items: list[T]
    total: int = Field(description="Total count of all items")
    page: int = Field(description="Current page number (1-indexed)")
    limit: int = Field(description="Items per page")
    total_pages: int = Field(description="Total number of pages")
    has_next: bool = Field(description="Whether there is a next page")
    has_previous: bool = Field(description="Whether there is a previous page")


def create_paginated_response(
    items: list[T],
    total: int,
    page: int,
    limit: int,
) -> dict:
    """Build paginated response data.
    
    Args:
        items: List of items for current page
        total: Total count of all items
        page: Current page number (1-indexed)
        limit: Items per page
        
    Returns:
        Dictionary with pagination metadata
    """
    total_pages = max(1, (total + limit - 1) // limit)
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_previous": page > 1,
    }


class SortOrder(str):
    """Sort order enum."""
    ASC = "asc"
    DESC = "desc"


class FilterParams(BaseModel):
    """Standard filtering parameters.
    
    Usage:
        @router.get("/items")
        async def list_items(
            filters: FilterParams = Depends(),
            pagination: PaginationParams = Depends(pagination_depends),
        ):
            items = repository.list_items_filtered(
                db,
                search=filters.search,
                skip=pagination.skip,
                limit=pagination.limit,
            )
    """
    search: Optional[str] = Field(
        None,
        description="Search term (across name, description, etc)",
        query_alias="search"
    )
    sort_by: Optional[str] = Field(
        None,
        description="Field name to sort by",
        query_alias="sort_by"
    )
    sort_order: SortOrder = Field(
        default=SortOrder.ASC,
        description="Sort order (asc or desc)",
        query_alias="sort_order"
    )
