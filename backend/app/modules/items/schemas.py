from datetime import datetime

from pydantic import BaseModel, Field


class ItemCreateRequest(BaseModel):
    """SECURITY: restaurant_id intentionally absent — assigned from authenticated context."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    more_details: str | None = None
    price: float = Field(..., gt=0)
    currency: str | None = None
    image_path: str | None = None
    image_path_2: str | None = None
    image_path_3: str | None = None
    image_path_4: str | None = None
    image_path_5: str | None = None
    video_path: str | None = None
    blog_link: str | None = None
    is_available: bool = True
    category_id: int


class ItemUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    more_details: str | None = None
    price: float | None = Field(None, gt=0)
    currency: str | None = None
    image_path: str | None = None
    image_path_2: str | None = None
    image_path_3: str | None = None
    image_path_4: str | None = None
    image_path_5: str | None = None
    video_path: str | None = None
    blog_link: str | None = None
    is_available: bool | None = None
    category_id: int | None = None


class ItemImageUploadResponse(BaseModel):
    image_path: str


class ItemMediaUploadResponse(BaseModel):
    slot: str
    path: str


class ItemResponse(BaseModel):
    id: int
    name: str
    description: str | None
    more_details: str | None
    price: float
    currency: str
    image_path: str | None
    image_path_2: str | None
    image_path_3: str | None
    image_path_4: str | None
    image_path_5: str | None
    video_path: str | None
    blog_link: str | None
    is_available: bool
    category_id: int
    restaurant_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
