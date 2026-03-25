from pydantic import BaseModel


class QRCodeResponse(BaseModel):
    qr_type: str
    target_number: str
    frontend_url: str
    qr_image_url: str
    restaurant_id: int


class BulkQRRequest(BaseModel):
    start: int
    end: int


class RoomBulkQRRequest(BaseModel):
    room_numbers: list[str]


class BulkQRCodeResponse(BaseModel):
    generated: list[QRCodeResponse]
    count: int


class RoomQRCodeListResponse(BaseModel):
    qrcodes: list[QRCodeResponse]
    total: int


class QRCodeDeleteResponse(BaseModel):
    message: str
