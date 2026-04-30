from datetime import datetime

from pydantic import BaseModel, Field


class QRCodeResponse(BaseModel):
    qr_type: str
    target_number: str
    frontend_url: str
    qr_image_url: str
    restaurant_id: int
    created_at: datetime


class BulkQRRequest(BaseModel):
    start: int = Field(..., ge=1)
    end: int = Field(..., ge=1)


class SingleTargetQRRequest(BaseModel):
    target_number: str = Field(..., min_length=1, max_length=50)


class RoomBulkQRRequest(BaseModel):
    room_numbers: list[str]


class BulkQRCodeResponse(BaseModel):
    generated: list[QRCodeResponse]
    count: int


class QRCodeListResponse(BaseModel):
    qrcodes: list[QRCodeResponse]
    total: int


class QRCodeDeleteResponse(BaseModel):
    message: str


class QRCodeResolveResponse(BaseModel):
    qr_type: str
    restaurant_id: int
    table_number: str | None = None
    room_number: str | None = None
    room_id: int | None = None


class QRRebuildResponse(BaseModel):
    message: str
    refreshed_count: int
    total_count: int
