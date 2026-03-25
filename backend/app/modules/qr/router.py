from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.modules.qr import service
from app.modules.qr.schemas import (
    BulkQRCodeResponse,
    BulkQRRequest,
    QRCodeDeleteResponse,
    QRCodeResponse,
    RoomQRCodeListResponse,
    RoomBulkQRRequest,
)
from app.modules.users.model import User

router = APIRouter()

# All QR generation endpoints are owner/admin only.
# restaurant_id is always derived from the authenticated user context.


@router.get("/table/{table_number}", response_model=QRCodeResponse)
def get_table_qr(
    table_number: str,
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> QRCodeResponse:
    """Generate or fetch QR code for a table.

    SECURITY: restaurant_id comes from authenticated user, not request body.
    """
    if current_user.restaurant_id is None:
        from fastapi import HTTPException, status
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return service.generate_qr(db, current_user.restaurant_id, "table", table_number)


@router.get("/room/{room_number}", response_model=QRCodeResponse)
def get_room_qr(
    room_number: str,
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> QRCodeResponse:
    """Generate or fetch QR code for a room.

    SECURITY: restaurant_id comes from authenticated user, not request body.
    """
    if current_user.restaurant_id is None:
        from fastapi import HTTPException, status
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return service.generate_qr(db, current_user.restaurant_id, "room", room_number)


@router.post("/tables/bulk", response_model=BulkQRCodeResponse)
def bulk_table_qr(
    payload: BulkQRRequest,
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> BulkQRCodeResponse:
    """Generate QR codes for a range of tables (start–end inclusive). Owner/admin only."""
    if current_user.restaurant_id is None:
        from fastapi import HTTPException, status
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return service.generate_bulk_table_qr(db, current_user.restaurant_id, payload.start, payload.end)


@router.post("/rooms/bulk", response_model=BulkQRCodeResponse)
def bulk_room_qr(
    payload: RoomBulkQRRequest,
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> BulkQRCodeResponse:
    """Generate QR codes for an explicit list of existing rooms. Owner/admin only."""
    if current_user.restaurant_id is None:
        from fastapi import HTTPException, status
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return service.generate_bulk_room_qr(db, current_user.restaurant_id, payload.room_numbers)


@router.get("/rooms", response_model=RoomQRCodeListResponse)
def list_room_qr(
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> RoomQRCodeListResponse:
    """List all room QR codes for current restaurant."""
    if current_user.restaurant_id is None:
        from fastapi import HTTPException, status
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return service.list_room_qr(db, current_user.restaurant_id)


@router.delete("/room/{room_number}", response_model=QRCodeDeleteResponse)
def delete_room_qr(
    room_number: str,
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> QRCodeDeleteResponse:
    """Delete one room QR code and its file if present."""
    if current_user.restaurant_id is None:
        from fastapi import HTTPException, status
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return service.delete_room_qr(db, current_user.restaurant_id, room_number)


@router.delete("/rooms", response_model=QRCodeDeleteResponse)
def delete_all_room_qr(
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> QRCodeDeleteResponse:
    """Delete all room QR codes and files for current restaurant."""
    if current_user.restaurant_id is None:
        from fastapi import HTTPException, status
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return service.delete_all_room_qr(db, current_user.restaurant_id)
