"""
Restaurant Repository
Data access for restaurants with multi-tenant support
"""

from sqlalchemy.orm import Session
from typing import Optional
from app.models import Restaurant
from app.repositories.base import BaseRepository


class RestaurantRepository(BaseRepository[Restaurant]):
    """Repository for restaurant entity"""

    def __init__(self, db: Session):
        super().__init__(db, Restaurant)

    def find_by_email(self, email: str) -> Optional[Restaurant]:
        """
        Find restaurant by email
        Note: Restaurants are not filtered by restaurant_id since we're looking up a tenant

        Args:
            email: Restaurant email address

        Returns:
            Restaurant object or None if not found
        """
        return self.db.query(self.model).filter(
            self.model.email == email
        ).first()

    def get_active_restaurants(self, limit: int = 50, offset: int = 0) -> list[Restaurant]:
        """
        Get all active restaurants (platform-level query, no context needed)

        Args:
            limit: Maximum records to return
            offset: Records to skip

        Returns:
            List of active restaurants
        """
        return self.db.query(self.model).filter(
            self.model.is_active == True
        ).limit(limit).offset(offset).all()

    def count_active(self) -> int:
        """Count active restaurants"""
        return self.db.query(self.model).filter(
            self.model.is_active == True
        ).count()
