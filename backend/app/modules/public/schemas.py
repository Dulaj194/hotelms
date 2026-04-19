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
    public_menu_banner_urls: list[str] = []
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
    subcategory_id: int | None

    model_config = {"from_attributes": True}


class PublicItemDetailResponse(BaseModel):
    id: int
    name: str
    description: str | None
    price: float
    image_path: str | None
    is_available: bool
    category_id: int
    subcategory_id: int | None
    category_name: str | None

    model_config = {"from_attributes": True}


# ─── Subcategories ────────────────────────────────────────────────────────────


class PublicSubcategoryResponse(BaseModel):
    id: int
    name: str
    description: str | None
    image_path: str | None
    sort_order: int
    items: list[PublicItemSummaryResponse]

    model_config = {"from_attributes": True}


# ─── Categories ───────────────────────────────────────────────────────────────


class PublicCategoryResponse(BaseModel):
    id: int
    name: str
    description: str | None
    image_path: str | None
    sort_order: int
    menu_id: int | None
    items: list[PublicItemSummaryResponse]      # items with no subcategory
    subcategories: list[PublicSubcategoryResponse]

    model_config = {"from_attributes": True}


# ─── Menu section ─────────────────────────────────────────────────────────────


class PublicMenuSectionResponse(BaseModel):
    id: int
    name: str
    description: str | None
    image_path: str | None
    sort_order: int
    categories: list[PublicCategoryResponse]


# ─── Full menu tree (composite) ───────────────────────────────────────────────


class PublicMenuResponse(BaseModel):
    restaurant: PublicRestaurantInfoResponse
    menus: list[PublicMenuSectionResponse]
    uncategorized_categories: list[PublicCategoryResponse]
    # Backward compatibility for existing clients expecting a flat category list.
    categories: list[PublicCategoryResponse]
