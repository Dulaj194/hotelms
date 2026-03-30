"""
Base Repository
Abstract repository with multi-tenant context enforcement
"""

from typing import TypeVar, Generic, List, Optional, Type
from sqlalchemy.orm import Session
from app.core.constants import ACCESS_HIDDEN, ACCESS_EDIT

T = TypeVar("T")  # Generic model type


class ContextNotSetError(Exception):
    """Raised when repository context (restaurant_id) is not set"""

    pass


class BaseRepository(Generic[T]):
    """
    Base repository with strict multi-tenant isolation
    Every query MUST be filtered by restaurant_id
    """

    def __init__(self, db: Session, model: Type[T]):
        self.db = db
        self.model = model
        self._context_restaurant_id: Optional[int] = None

    def set_context(self, restaurant_id: int) -> "BaseRepository":
        """
        Set multi-tenant context
        MUST be called before any query for tenant-owned entities

        Args:
            restaurant_id: The restaurant (tenant) ID

        Returns:
            self for method chaining

        Example:
            repo.set_context(5).get_by_id(10)
        """
        if not isinstance(restaurant_id, int) or restaurant_id <= 0:
            raise ValueError(f"Invalid restaurant_id: {restaurant_id}")

        self._context_restaurant_id = restaurant_id
        return self

    def _ensure_context(self) -> None:
        """
        Ensure context is set before querying
        Prevents accidental cross-tenant data leaks
        """
        if self._context_restaurant_id is None:
            raise ContextNotSetError(
                f"Multi-tenant context not set for {self.model.__name__}. "
                "Call set_context(restaurant_id) first."
            )

    def _apply_restaurant_filter(self, query):
        """
        Apply restaurant_id filter to query
        Override in subclasses if entity doesn't have restaurant_id
        """
        if hasattr(self.model, "restaurant_id"):
            return query.filter(self.model.restaurant_id == self._context_restaurant_id)
        return query

    # CRUD Operations

    def get_by_id(self, id: int) -> Optional[T]:
        """
        Get single record by ID (filtered by restaurant_id)

        Args:
            id: Record ID

        Returns:
            Record or None

        Raises:
            ContextNotSetError: If context not set
        """
        self._ensure_context()

        query = self.db.query(self.model).filter(self.model.id == id)
        return self._apply_restaurant_filter(query).first()

    def get_all(self, limit: int = 50, offset: int = 0) -> List[T]:
        """
        Get all records for current tenant

        Args:
            limit: Maximum records to return
            offset: Records to skip

        Returns:
            List of records

        Raises:
            ContextNotSetError: If context not set
        """
        self._ensure_context()

        query = self.db.query(self.model)
        query = self._apply_restaurant_filter(query)
        return query.limit(limit).offset(offset).all()

    def count(self) -> int:
        """
        Count records for current tenant

        Returns:
            Total count

        Raises:
            ContextNotSetError: If context not set
        """
        self._ensure_context()

        query = self.db.query(self.model)
        return self._apply_restaurant_filter(query).count()

    def create(self, **kwargs) -> T:
        """
        Create new record (auto-set restaurant_id)

        Args:
            **kwargs: Record data

        Returns:
            Created record

        Raises:
            ContextNotSetError: If context not set
        """
        self._ensure_context()

        # Force restaurant_id to current context
        if hasattr(self.model, "restaurant_id"):
            kwargs["restaurant_id"] = self._context_restaurant_id

        instance = self.model(**kwargs)
        self.db.add(instance)
        self.db.flush()
        return instance

    def update(self, id: int, **kwargs) -> Optional[T]:
        """
        Update record (must belong to tenant)

        Args:
            id: Record ID
            **kwargs: Fields to update

        Returns:
            Updated record or None

        Raises:
            ContextNotSetError: If context not set
        """
        self._ensure_context()

        # Prevent changing restaurant_id
        kwargs.pop("restaurant_id", None)

        instance = self.get_by_id(id)
        if not instance:
            return None

        for key, value in kwargs.items():
            setattr(instance, key, value)

        self.db.flush()
        return instance

    def delete(self, id: int) -> bool:
        """
        Delete record (must belong to tenant)

        Args:
            id: Record ID

        Returns:
            True if deleted, False if not found

        Raises:
            ContextNotSetError: If context not set
        """
        self._ensure_context()

        instance = self.get_by_id(id)
        if not instance:
            return False

        self.db.delete(instance)
        self.db.flush()
        return True

    def save(self) -> None:
        """Commit changes to database"""
        self.db.commit()

    def rollback(self) -> None:
        """Rollback changes"""
        self.db.rollback()

    # Ownership Validation (for nested resources)

    def verify_ownership(self, resource_id: int, parent_field: str, parent_id: int) -> bool:
        """
        Verify that a resource belongs to a parent in the same restaurant
        Used for nested resources (e.g., item must belong to category of same restaurant)

        Args:
            resource_id: The resource ID to verify
            parent_field: The parent field name (e.g., "category_id")
            parent_id: The parent ID to check

        Returns:
            True if resource belongs to parent in same restaurant

        Example:
            # Verify item belongs to category
            is_valid = item_repo.verify_ownership(
                resource_id=item_id,
                parent_field="category_id",
                parent_id=category_id
            )
        """
        self._ensure_context()

        query = self.db.query(self.model).filter(
            self.model.id == resource_id,
            getattr(self.model, parent_field) == parent_id,
        )

        return self._apply_restaurant_filter(query).first() is not None
