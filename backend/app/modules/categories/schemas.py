from datetime import datetime

from pydantic import BaseModel, Field


class CategoryCreateRequest(BaseModel):
    """SECURITY: restaurant_id intentionally absent — assigned from authenticated context."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    image_path: str | None = None
    sort_order: int = 0
    is_active: bool = True
    menu_id: int = Field(..., gt=0)


class CategoryUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    image_path: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None
    menu_id: int | None = Field(None, gt=0)


class CategoryImageUploadResponse(BaseModel):
    image_path: str


class CategoryResponse(BaseModel):
    id: int
    name: str
    description: str | None
    image_path: str | None
    sort_order: int
    is_active: bool
    menu_id: int
    restaurant_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
