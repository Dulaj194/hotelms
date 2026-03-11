from datetime import datetime

from pydantic import BaseModel, Field


class ItemCreateRequest(BaseModel):
    """SECURITY: restaurant_id intentionally absent — assigned from authenticated context."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    price: float = Field(..., ge=0)
    image_path: str | None = None
    is_available: bool = True
    category_id: int


class ItemUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    price: float | None = Field(None, ge=0)
    image_path: str | None = None
    is_available: bool | None = None
    category_id: int | None = None


class ItemResponse(BaseModel):
    id: int
    name: str
    description: str | None
    price: float
    image_path: str | None
    is_available: bool
    category_id: int
    restaurant_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
