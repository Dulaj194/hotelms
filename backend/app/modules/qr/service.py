import hashlib
import socket
from pathlib import Path
from urllib.parse import quote, urlencode, urlparse

import qrcode
import qrcode.image.pil
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_room_qr_access_token, create_table_qr_access_token
from app.modules.qr import repository
from app.modules.qr.schemas import (
    BulkQRCodeResponse,
    QRCodeDeleteResponse,
    QRCodeListResponse,
    QRCodeResponse,
)
from app.modules.rooms.repository import get_room_by_number_and_restaurant

_QR_DIR = Path(settings.upload_dir) / "qrcodes"
_VALID_QR_TYPES = {"table", "room"}
_MAX_TARGET_LENGTH = 50
_LOCALHOST_HOSTS = {"localhost", "127.0.0.1", "::1"}

# Ensure the QR directory exists at import time (safe to call multiple times).
_QR_DIR.mkdir(parents=True, exist_ok=True)


def _normalize_frontend_base_url(frontend_base_url: str | None) -> str | None:
    if not frontend_base_url:
        return None

    raw = frontend_base_url.strip()
    if not raw:
        return None

    parsed = urlparse(raw)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")

    return None


def _is_localhost_base_url(base_url: str) -> bool:
    parsed = urlparse(base_url)
    hostname = (parsed.hostname or "").strip().lower()
    return hostname in _LOCALHOST_HOSTS


def _first_configured_non_local_frontend_url() -> str | None:
    candidates: list[str] = []

    frontend_urls = getattr(settings, "frontend_urls", "")
    if isinstance(frontend_urls, str) and frontend_urls.strip():
        candidates.extend(
            part.strip() for part in frontend_urls.split(",") if part.strip()
        )

    if settings.frontend_url:
        candidates.append(settings.frontend_url)

    for candidate in candidates:
        normalized = _normalize_frontend_base_url(candidate)
        if normalized and not _is_localhost_base_url(normalized):
            return normalized

    return None


def _detect_lan_ipv4() -> str | None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            ip = sock.getsockname()[0]
    except OSError:
        return None

    if not ip or ip.startswith("127."):
        return None
    return ip


def _replace_localhost_with_lan(base_url: str) -> str | None:
    if not _is_localhost_base_url(base_url):
        return None

    lan_ip = _detect_lan_ipv4()
    if not lan_ip:
        return None

    parsed = urlparse(base_url)
    scheme = parsed.scheme or "http"
    port_segment = f":{parsed.port}" if parsed.port else ""
    return f"{scheme}://{lan_ip}{port_segment}"


def _resolve_frontend_base_url(frontend_base_url: str | None = None) -> str:
    normalized = _normalize_frontend_base_url(frontend_base_url)
    if normalized:
        if not _is_localhost_base_url(normalized):
            return normalized

        configured_non_local = _first_configured_non_local_frontend_url()
        if configured_non_local:
            return configured_non_local

        lan_reachable = _replace_localhost_with_lan(normalized)
        if lan_reachable:
            return lan_reachable

    return settings.frontend_url.rstrip("/")


def _build_qr_access_key(restaurant_id: int, qr_type: str, target_number: str) -> str:
    if qr_type == "table":
        return create_table_qr_access_token(
            restaurant_id=restaurant_id,
            table_number=target_number,
            expire_days=settings.room_qr_key_expire_days,
        )
    if qr_type == "room":
        return create_room_qr_access_token(
            restaurant_id=restaurant_id,
            room_number=target_number,
            expire_days=settings.room_qr_key_expire_days,
        )
    return ""


def _build_frontend_url(
    restaurant_id: int,
    qr_type: str,
    target_number: str,
    frontend_base_url: str | None = None,
) -> str:
    """Build the public menu URL that gets encoded into the QR image."""
    base = _resolve_frontend_base_url(frontend_base_url)
    safe_target = quote(target_number, safe="")
    qr_access_key = _build_qr_access_key(restaurant_id, qr_type, target_number)
    if qr_access_key:
        return f"{base}/menu/{restaurant_id}/{qr_type}/{safe_target}?{urlencode({'k': qr_access_key})}"
    # /menu/{restaurant_id}/{type}/{number}
    return f"{base}/menu/{restaurant_id}/{qr_type}/{safe_target}"


def _qr_filename(restaurant_id: int, qr_type: str, target_number: str) -> str:
    """Deterministic safe filename: independent from raw target characters."""
    digest = hashlib.sha256(target_number.encode("utf-8")).hexdigest()[:16]
    return f"qr_{restaurant_id}_{qr_type}_{digest}.png"


def _normalize_target_number(target_number: str, qr_type: str) -> str:
    normalized = target_number.strip()
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{_qr_label(qr_type)} number is required.",
        )
    if len(normalized) > _MAX_TARGET_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"{_qr_label(qr_type)} number must be at most "
                f"{_MAX_TARGET_LENGTH} characters."
            ),
        )
    if "/" in normalized or "\\" in normalized:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{_qr_label(qr_type)} number contains invalid characters.",
        )
    return normalized


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
        created_at=qr_record.created_at,
    )


def _validate_qr_type(qr_type: str) -> str:
    normalized = qr_type.strip().lower()
    if normalized not in _VALID_QR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid QR type '{qr_type}'. Must be 'table' or 'room'.",
        )
    return normalized


def _qr_label(qr_type: str) -> str:
    return "Room" if qr_type == "room" else "Table"


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


def _has_secure_qr_key(frontend_url: str | None) -> bool:
    return "k=" in (frontend_url or "")


def _should_refresh_qr(file_path: Path, stored_frontend_url: str | None, expected_frontend_url: str) -> bool:
    return (
        not file_path.exists()
        or not _has_secure_qr_key(stored_frontend_url)
        or (stored_frontend_url or "") != expected_frontend_url
    )


def _regenerate_and_upsert_qr(
    db: Session,
    restaurant_id: int,
    qr_type: str,
    target_number: str,
    file_path: Path,
    frontend_url: str,
):
    _generate_qr_image(frontend_url, file_path)
    return repository.upsert_qr(
        db,
        restaurant_id=restaurant_id,
        qr_type=qr_type,
        target_number=target_number,
        file_path=str(file_path),
        frontend_url=frontend_url,
    )


def generate_qr(
    db: Session,
    restaurant_id: int,
    qr_type: str,
    target_number: str,
    frontend_base_url: str | None = None,
) -> QRCodeResponse:
    """Generate (or reuse) a QR code for the given target.

    SECURITY: restaurant_id must come from the authenticated context.
    It is passed explicitly by the router — never accepted from the client body.
    """
    qr_type = _validate_qr_type(qr_type)

    target_number = _normalize_target_number(target_number, qr_type)

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

    frontend_url = _build_frontend_url(
        restaurant_id,
        qr_type,
        target_number,
        frontend_base_url,
    )
    filename = _qr_filename(restaurant_id, qr_type, target_number)
    file_path = _QR_DIR / filename

    # Check DB first — if record exists, reuse (file should already be on disk)
    existing = repository.get_qr(db, restaurant_id, qr_type, target_number)
    if existing:
        if _should_refresh_qr(file_path, existing.frontend_url, frontend_url):
            existing = _regenerate_and_upsert_qr(
                db,
                restaurant_id=restaurant_id,
                qr_type=qr_type,
                target_number=target_number,
                file_path=file_path,
                frontend_url=frontend_url,
            )
        return _to_response(existing, restaurant_id)

    # New QR — generate image and persist metadata
    qr_record = _regenerate_and_upsert_qr(
        db,
        restaurant_id=restaurant_id,
        qr_type=qr_type,
        target_number=target_number,
        file_path=file_path,
        frontend_url=frontend_url,
    )
    return _to_response(qr_record, restaurant_id)


def generate_bulk_table_qr(
    db: Session,
    restaurant_id: int,
    start: int,
    end: int,
    frontend_base_url: str | None = None,
) -> BulkQRCodeResponse:
    """Generate QR codes for a range of table numbers."""
    if start > end or end - start > 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Range must be valid and contain at most 200 items.",
        )

    results = [
        generate_qr(
            db,
            restaurant_id,
            "table",
            str(n),
            frontend_base_url=frontend_base_url,
        )
        for n in range(start, end + 1)
    ]
    return BulkQRCodeResponse(generated=results, count=len(results))


def generate_bulk_room_qr(
    db: Session,
    restaurant_id: int,
    room_numbers: list[str],
    frontend_base_url: str | None = None,
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
        generate_qr(
            db,
            restaurant_id,
            "room",
            room_number,
            frontend_base_url=frontend_base_url,
        )
        for room_number in normalized
    ]
    return BulkQRCodeResponse(generated=results, count=len(results))


def rebuild_qr_links_by_type(
    db: Session,
    restaurant_id: int,
    qr_type: str,
    frontend_base_url: str | None = None,
) -> tuple[int, int]:
    """Refresh stored QR links/images for one QR type against the current frontend base URL."""
    normalized_qr_type = _validate_qr_type(qr_type)
    records = repository.list_qr_by_type(db, restaurant_id, normalized_qr_type)
    if not records:
        return 0, 0

    refreshed = _refresh_qr_records_for_base_url(
        db,
        restaurant_id,
        normalized_qr_type,
        records,
        frontend_base_url,
    )

    return refreshed, len(records)


def _refresh_qr_records_for_base_url(
    db: Session,
    restaurant_id: int,
    normalized_qr_type: str,
    records,
    frontend_base_url: str | None,
) -> int:
    refreshed = 0
    for record in records:
        try:
            target_number = _normalize_target_number(record.target_number, normalized_qr_type)
        except HTTPException:
            # Keep list/rebuild resilient for legacy malformed records.
            continue
        frontend_url = _build_frontend_url(
            restaurant_id,
            normalized_qr_type,
            target_number,
            frontend_base_url,
        )
        file_path = _QR_DIR / _qr_filename(restaurant_id, normalized_qr_type, target_number)
        if _should_refresh_qr(file_path, record.frontend_url, frontend_url):
            _regenerate_and_upsert_qr(
                db,
                restaurant_id=restaurant_id,
                qr_type=normalized_qr_type,
                target_number=target_number,
                file_path=file_path,
                frontend_url=frontend_url,
            )
            refreshed += 1
    return refreshed


def list_room_qr(
    db: Session,
    restaurant_id: int,
    frontend_base_url: str | None = None,
) -> QRCodeListResponse:
    return list_qr(db, restaurant_id, "room", frontend_base_url=frontend_base_url)


def list_table_qr(
    db: Session,
    restaurant_id: int,
    frontend_base_url: str | None = None,
) -> QRCodeListResponse:
    return list_qr(db, restaurant_id, "table", frontend_base_url=frontend_base_url)


def list_qr(
    db: Session,
    restaurant_id: int,
    qr_type: str,
    frontend_base_url: str | None = None,
) -> QRCodeListResponse:
    normalized_qr_type = _validate_qr_type(qr_type)
    records = repository.list_qr_by_type(db, restaurant_id, normalized_qr_type)
    if records and frontend_base_url is not None:
        _refresh_qr_records_for_base_url(
            db,
            restaurant_id,
            normalized_qr_type,
            records,
            frontend_base_url,
        )
        records = repository.list_qr_by_type(db, restaurant_id, normalized_qr_type)
    responses = [_to_response(record, restaurant_id) for record in records]
    return QRCodeListResponse(qrcodes=responses, total=len(responses))


def delete_room_qr(
    db: Session,
    restaurant_id: int,
    room_number: str,
) -> QRCodeDeleteResponse:
    return delete_qr(db, restaurant_id, "room", room_number)


def delete_table_qr(
    db: Session,
    restaurant_id: int,
    table_number: str,
) -> QRCodeDeleteResponse:
    return delete_qr(db, restaurant_id, "table", table_number)


def delete_qr(
    db: Session,
    restaurant_id: int,
    qr_type: str,
    target_number: str,
) -> QRCodeDeleteResponse:
    normalized_qr_type = _validate_qr_type(qr_type)
    normalized_target = _normalize_target_number(target_number, normalized_qr_type)

    deleted = repository.delete_qr(db, restaurant_id, normalized_qr_type, normalized_target)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{_qr_label(normalized_qr_type)} QR '{normalized_target}' not found.",
        )

    _delete_qr_file_if_exists(deleted.file_path)
    return QRCodeDeleteResponse(
        message=f"{_qr_label(normalized_qr_type)} QR '{normalized_target}' deleted."
    )


def delete_all_room_qr(
    db: Session,
    restaurant_id: int,
) -> QRCodeDeleteResponse:
    return delete_all_qr(db, restaurant_id, "room")


def delete_all_table_qr(
    db: Session,
    restaurant_id: int,
) -> QRCodeDeleteResponse:
    return delete_all_qr(db, restaurant_id, "table")


def delete_all_qr(
    db: Session,
    restaurant_id: int,
    qr_type: str,
) -> QRCodeDeleteResponse:
    normalized_qr_type = _validate_qr_type(qr_type)
    deleted_records = repository.delete_qr_by_type(db, restaurant_id, normalized_qr_type)
    for record in deleted_records:
        _delete_qr_file_if_exists(record.file_path)
    return QRCodeDeleteResponse(
        message=f"Deleted {len(deleted_records)} {normalized_qr_type} QR code(s).",
    )
