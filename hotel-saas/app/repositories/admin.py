"""
Admin Repository
Data access for admin/staff users with multi-tenant support
"""

from sqlalchemy.orm import Session
from typing import Optional
from app.models import Admin
from app.repositories.base import BaseRepository


class AdminRepository(BaseRepository[Admin]):
    """Repository for admin/staff entity"""

    def __init__(self, db: Session):
        super().__init__(db, Admin)

    def find_by_email(self, email: str, restaurant_id: Optional[int] = None) -> Optional[Admin]:
        """
        Find admin by email
        If restaurant_id provided, filters to that restaurant

        Args:
            email: Admin email address
            restaurant_id: Optional restaurant context for multi-tenant filtering

        Returns:
            Admin object or None if not found
        """
        query = self.db.query(self.model).filter(self.model.email == email)

        if restaurant_id:
            query = query.filter(self.model.restaurant_id == restaurant_id)

        return query.first()

    def find_by_email_in_restaurant(self, email: str, restaurant_id: int) -> Optional[Admin]:
        """
        Find admin by email in specific restaurant
        Enforces restaurant context (multi-tenant safety)

        Args:
            email: Admin email
            restaurant_id: Restaurant context

        Returns:
            Admin object or None
        """
        return self.db.query(self.model).filter(
            self.model.email == email,
            self.model.restaurant_id == restaurant_id
        ).first()

    def get_by_id_in_restaurant(self, admin_id: int, restaurant_id: int) -> Optional[Admin]:
        """
        Get admin by ID, enforcing restaurant context

        Args:
            admin_id: Admin ID
            restaurant_id: Restaurant context

        Returns:
            Admin object or None
        """
        return self.db.query(self.model).filter(
            self.model.admin_id == admin_id,
            self.model.restaurant_id == restaurant_id
        ).first()

    def get_active_in_restaurant(self, restaurant_id: int) -> list[Admin]:
        """
        Get all active admins in a specific restaurant

        Args:
            restaurant_id: Restaurant context

        Returns:
            List of active admins
        """
        return self.db.query(self.model).filter(
            self.model.restaurant_id == restaurant_id,
            self.model.is_active == True
        ).all()

    def count_in_restaurant(self, restaurant_id: int) -> int:
        """
        Count admins in a restaurant

        Args:
            restaurant_id: Restaurant context

        Returns:
            Number of admins
        """
        return self.db.query(self.model).filter(
            self.model.restaurant_id == restaurant_id
        ).count()
