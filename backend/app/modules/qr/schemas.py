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
