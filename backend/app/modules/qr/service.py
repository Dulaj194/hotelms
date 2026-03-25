from pathlib import Path
from urllib.parse import quote, urlencode

import qrcode
import qrcode.image.pil
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_room_qr_access_token
from app.modules.qr import repository
from app.modules.qr.schemas import (
    BulkQRCodeResponse,
    QRCodeDeleteResponse,
    QRCodeResponse,
    RoomQRCodeListResponse,
)
from app.modules.rooms.repository import get_room_by_number_and_restaurant

_QR_DIR = Path(settings.upload_dir) / "qrcodes"

# Ensure the QR directory exists at import time (safe to call multiple times).
_QR_DIR.mkdir(parents=True, exist_ok=True)


def _build_frontend_url(restaurant_id: int, qr_type: str, target_number: str) -> str:
    """Build the public menu URL that gets encoded into the QR image."""
    base = settings.frontend_url.rstrip("/")
    safe_target = quote(target_number, safe="")
    if qr_type == "room":
        qr_access_key = create_room_qr_access_token(
            restaurant_id=restaurant_id,
            room_number=target_number,
            expire_days=settings.room_qr_key_expire_days,
        )
        return f"{base}/menu/{restaurant_id}/{qr_type}/{safe_target}?{urlencode({'k': qr_access_key})}"
    # /menu/{restaurant_id}/{type}/{number}
    return f"{base}/menu/{restaurant_id}/{qr_type}/{safe_target}"


def _qr_filename(restaurant_id: int, qr_type: str, target_number: str) -> str:
    """Deterministic filename: reuse same file if QR already generated."""
    return f"qr_{restaurant_id}_{qr_type}_{target_number}.png"


def _generate_qr_image(frontend_url: str, file_path: Path) -> None:
    """Render a QR PNG to disk using the qrcode library."""
    qr = qrcode.QRCode(
        version=None,          # auto-size
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(frontend_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(str(file_path))


def _to_response(qr_record, restaurant_id: int) -> QRCodeResponse:
    qr_image_url = f"/uploads/qrcodes/{Path(qr_record.file_path).name}"
    return QRCodeResponse(
        qr_type=qr_record.qr_type,
        target_number=qr_record.target_number,
        frontend_url=qr_record.frontend_url,
        qr_image_url=qr_image_url,
        restaurant_id=restaurant_id,
    )


def _resolve_qr_file_path(file_path: str) -> Path:
    path = Path(file_path)
    if path.is_absolute():
        return path
    if path.exists():
        return path
    return _QR_DIR / path.name


def _delete_qr_file_if_exists(file_path: str) -> None:
    path = _resolve_qr_file_path(file_path)
    if path.exists():
        try:
            path.unlink()
        except OSError:
            # Keep DB deletion successful even if local file cleanup fails.
            return


def generate_qr(
    db: Session,
    restaurant_id: int,
    qr_type: str,
    target_number: str,
) -> QRCodeResponse:
    """Generate (or reuse) a QR code for the given target.

    SECURITY: restaurant_id must come from the authenticated context.
    It is passed explicitly by the router — never accepted from the client body.
    """
    if qr_type not in ("table", "room"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid QR type '{qr_type}'. Must be 'table' or 'room'.",
        )

    target_number = target_number.strip()
    if not target_number:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Target number is required.",
        )

    if qr_type == "room":
        room = get_room_by_number_and_restaurant(db, target_number, restaurant_id)
        if not room:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Room '{target_number}' not found.",
            )
        if not room.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Room '{target_number}' is not currently active.",
            )
        target_number = room.room_number

    frontend_url = _build_frontend_url(restaurant_id, qr_type, target_number)
    filename = _qr_filename(restaurant_id, qr_type, target_number)
    file_path = _QR_DIR / filename

    # Check DB first — if record exists, reuse (file should already be on disk)
    existing = repository.get_qr(db, restaurant_id, qr_type, target_number)
    if existing:
        has_secure_room_key = qr_type != "room" or "k=" in (existing.frontend_url or "")
        # Re-generate if file is missing or if this is a legacy room QR without secure key.
        if not file_path.exists() or not has_secure_room_key:
            _generate_qr_image(frontend_url, file_path)
            existing = repository.upsert_qr(
                db,
                restaurant_id=restaurant_id,
                qr_type=qr_type,
                target_number=target_number,
                file_path=str(file_path),
                frontend_url=frontend_url,
            )
        return _to_response(existing, restaurant_id)

    # New QR — generate image and persist metadata
    _generate_qr_image(frontend_url, file_path)
    qr_record = repository.upsert_qr(
        db,
        restaurant_id=restaurant_id,
        qr_type=qr_type,
        target_number=target_number,
        file_path=str(file_path),
        frontend_url=frontend_url,
    )
    return _to_response(qr_record, restaurant_id)


def generate_bulk_table_qr(
    db: Session,
    restaurant_id: int,
    start: int,
    end: int,
) -> BulkQRCodeResponse:
    """Generate QR codes for a range of table numbers."""
    if start > end or end - start > 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Range must be valid and contain at most 200 items.",
        )

    results = [
        generate_qr(db, restaurant_id, "table", str(n))
        for n in range(start, end + 1)
    ]
    return BulkQRCodeResponse(generated=results, count=len(results))


def generate_bulk_room_qr(
    db: Session,
    restaurant_id: int,
    room_numbers: list[str],
) -> BulkQRCodeResponse:
    """Generate QR codes for an explicit list of existing room numbers."""
    normalized: list[str] = []
    seen: set[str] = set()

    for raw_number in room_numbers:
        room_number = raw_number.strip()
        if not room_number or room_number in seen:
            continue
        normalized.append(room_number)
        seen.add(room_number)

    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one room number is required.",
        )

    if len(normalized) > 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can generate at most 200 room QR codes at once.",
        )

    results = [
        generate_qr(db, restaurant_id, "room", room_number)
        for room_number in normalized
    ]
    return BulkQRCodeResponse(generated=results, count=len(results))


def list_room_qr(
    db: Session,
    restaurant_id: int,
) -> RoomQRCodeListResponse:
    records = repository.list_qr_by_type(db, restaurant_id, "room")
    responses = [_to_response(record, restaurant_id) for record in records]
    return RoomQRCodeListResponse(qrcodes=responses, total=len(responses))


def delete_room_qr(
    db: Session,
    restaurant_id: int,
    room_number: str,
) -> QRCodeDeleteResponse:
    normalized_room = room_number.strip()
    if not normalized_room:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Room number is required.",
        )

    deleted = repository.delete_qr(db, restaurant_id, "room", normalized_room)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Room QR '{normalized_room}' not found.",
        )

    _delete_qr_file_if_exists(deleted.file_path)
    return QRCodeDeleteResponse(message=f"Room QR '{normalized_room}' deleted.")


def delete_all_room_qr(
    db: Session,
    restaurant_id: int,
) -> QRCodeDeleteResponse:
    deleted_records = repository.delete_qr_by_type(db, restaurant_id, "room")
    for record in deleted_records:
        _delete_qr_file_if_exists(record.file_path)
    return QRCodeDeleteResponse(
        message=f"Deleted {len(deleted_records)} room QR code(s).",
    )
