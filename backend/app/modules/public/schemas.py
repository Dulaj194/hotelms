from __future__ import annotations

from pydantic import BaseModel


# ─── Restaurant ───────────────────────────────────────────────────────────────


class PublicRestaurantInfoResponse(BaseModel):
    """Public-safe restaurant info. Never include admin-only fields (email, etc.)."""

    id: int
    name: str
    phone: str | None
    address: str | None
    logo_url: str | None
    is_active: bool

    model_config = {"from_attributes": True}


# ─── Items ────────────────────────────────────────────────────────────────────


class PublicItemSummaryResponse(BaseModel):
    id: int
    name: str
    description: str | None
    price: float
    image_path: str | None
    is_available: bool
    category_id: int

    model_config = {"from_attributes": True}


class PublicItemDetailResponse(BaseModel):
    id: int
    name: str
    description: str | None
    price: float
    image_path: str | None
    is_available: bool
    category_id: int
    category_name: str | None

    model_config = {"from_attributes": True}


# ─── Categories ───────────────────────────────────────────────────────────────


class PublicCategoryResponse(BaseModel):
    id: int
    name: str
    description: str | None
    image_path: str | None
    sort_order: int
    items: list[PublicItemSummaryResponse]

    model_config = {"from_attributes": True}


# ─── Menu (composite) ────────────────────────────────────────────────────────


class PublicMenuResponse(BaseModel):
    restaurant: PublicRestaurantInfoResponse
    categories: list[PublicCategoryResponse]
