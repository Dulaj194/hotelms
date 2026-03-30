"""Repository layer for data access."""

from app.repositories.admin import AdminRepository
from app.repositories.base import BaseRepository
from app.repositories.restaurant import RestaurantRepository
from app.repositories.super_admin import SuperAdminRepository

__all__ = [
    "BaseRepository",
    "AdminRepository",
    "RestaurantRepository",
    "SuperAdminRepository",
]
