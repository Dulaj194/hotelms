from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field

# ─── Restaurant ───────────────────────────────────────────────────────────────


class PublicRestaurantInfoResponse(BaseModel):
    """Public-safe restaurant info. Never include admin-only fields (email, etc.)."""

    id: int
    name: str
    phone: str | None
    address: str | None
    logo_url: str | None
    public_menu_banner_urls: list[str] = Field(default_factory=list)
    is_active: bool

    model_config = {"from_attributes": True}


# ─── Offers ───────────────────────────────────────────────────────────────────


class PublicOfferResponse(BaseModel):
    id: int
    title: str
    description: str
    image_path: str | None
    product_type: Literal["menu", "category", "item"]
    product_id: int
    is_featured: bool = False

    model_config = {"from_attributes": True}


# ─── Items ────────────────────────────────────────────────────────────────────


class PublicItemSummaryResponse(BaseModel):
    id: int
    name: str
    name_si: str | None = None
    description: str | None
    description_si: str | None = None
    price: float
    image_path: str | None
    image_path_2: str | None = None
    image_path_3: str | None = None
    image_path_4: str | None = None
    image_path_5: str | None = None
    video_path: str | None = None
    more_details: str | None = None
    more_details_si: str | None = None
    blog_link: str | None = None
    is_available: bool
    category_id: int

    model_config = {"from_attributes": True}


class PublicItemDetailResponse(BaseModel):
    id: int
    name: str
    name_si: str | None = None
    description: str | None
    description_si: str | None = None
    price: float
    image_path: str | None
    image_path_2: str | None = None
    image_path_3: str | None = None
    image_path_4: str | None = None
    image_path_5: str | None = None
    video_path: str | None = None
    more_details: str | None = None
    blog_link: str | None = None
    is_available: bool
    category_id: int
    category_name: str | None
    category_name_si: str | None = None

    model_config = {"from_attributes": True}


# ─── Categories ───────────────────────────────────────────────────────────────


class PublicCategoryResponse(BaseModel):
    id: int
    name: str
    name_si: str | None = None
    description: str | None
    description_si: str | None = None
    image_path: str | None
    sort_order: int
    menu_id: int
    items: list[PublicItemSummaryResponse]

    model_config = {"from_attributes": True}


# ─── Menu section ─────────────────────────────────────────────────────────────


class PublicMenuSectionResponse(BaseModel):
    id: int
    name: str
    name_si: str | None = None
    description: str | None
    description_si: str | None = None
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
    offers: list[PublicOfferResponse] = Field(default_factory=list)
