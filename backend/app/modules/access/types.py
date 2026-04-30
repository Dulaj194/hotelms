"""Type definitions for context objects used in super admin workflows.

These TypedDicts provide type safety for context maps that are passed around
in service and serialization functions, replacing raw `dict[int, object]` types.
"""
from typing import TypedDict, Optional


class UserContext(TypedDict, total=False):
    """Represents a User object in context maps.
    
    Used instead of `object` for type safety when passing user maps
    to serialization functions.
    """
    id: int
    full_name: Optional[str]
    email: Optional[str]
    username: Optional[str]
    phone: Optional[str]
    is_active: bool


class RestaurantContext(TypedDict, total=False):
    """Represents a Restaurant object in context maps.
    
    Used instead of `object` for type safety when passing restaurant maps
    to serialization functions.
    """
    id: int
    name: str
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    city: Optional[str]
    country: Optional[str]


class PackageContext(TypedDict, total=False):
    """Represents a Package object in context maps."""
    id: int
    name: str
    code: str
    price: float
    billing_period_days: int
    is_active: bool


# Type aliases for common map signatures
UserMap = dict[int, UserContext]
RestaurantMap = dict[int, RestaurantContext]
PackageMap = dict[int, PackageContext]
