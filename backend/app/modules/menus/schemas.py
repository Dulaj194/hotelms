from datetime import datetime

from pydantic import BaseModel, Field


class MenuCreateRequest(BaseModel):
    """SECURITY: restaurant_id intentionally absent — assigned from authenticated context."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    sort_order: int = 0
    is_active: bool = True


class MenuUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class MenuImageUploadResponse(BaseModel):
    image_path: str


class MenuResponse(BaseModel):
    id: int
    name: str
    description: str | None
    image_path: str | None
    sort_order: int
    is_active: bool
    restaurant_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
