from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_module_access, require_roles
from app.modules.access import role_catalog
from app.modules.qr import service
from app.modules.qr.schemas import (
    BulkQRCodeResponse,
    BulkQRRequest,
    QRCodeDeleteResponse,
    QRCodeListResponse,
    QRCodeResolveResponse,
    QRCodeResponse,
    QRRebuildResponse,
    RoomBulkQRRequest,
    SingleTargetQRRequest,
)
from app.modules.users.model import User

router = APIRouter()

_RESTAURANT_ADMIN_ROLES = role_catalog.RESTAURANT_ADMIN_ROLES

# All QR administration endpoints are owner/admin only.
# restaurant_id is always derived from the authenticated user context.


def _require_restaurant_context(current_user: User) -> int:
    if current_user.restaurant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No restaurant context.",
        )
    return current_user.restaurant_id


def _request_frontend_base_url(request: Request) -> str | None:
    origin = request.headers.get("origin", "").strip()
    if origin:
        return origin

    referer = request.headers.get("referer", "").strip()
    if not referer:
        return None

    parsed = urlparse(referer)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    return None


@router.get("/resolve/{table_key}", response_model=QRCodeResolveResponse)
def resolve_table_qr(
    table_key: str,
    db: Session = Depends(get_db),
) -> QRCodeResolveResponse:
    """Resolve a public table QR key before loading the customer menu."""
    return service.resolve_table_qr_key(db, table_key)


@router.get("/room/resolve/{room_key}", response_model=QRCodeResolveResponse)
def resolve_room_qr(
    room_key: str,
    db: Session = Depends(get_db),
) -> QRCodeResolveResponse:
    """Resolve a public room QR key before loading the customer menu."""
    return service.resolve_room_qr_key(db, room_key)


@router.get("/table/{table_number}", response_model=QRCodeResponse)
def get_table_qr(
    table_number: str,
    request: Request,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
    __: bool = Depends(require_module_access("qr")),
) -> QRCodeResponse:
    """Generate or fetch QR code for a table."""
    return service.generate_qr(
        db,
        _require_restaurant_context(current_user),
        "table",
        table_number,
        frontend_base_url=_request_frontend_base_url(request),
    )


@router.post("/table", response_model=QRCodeResponse)
def create_table_qr(
    payload: SingleTargetQRRequest,
    request: Request,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
    __: bool = Depends(require_module_access("qr")),
) -> QRCodeResponse:
    """Generate or fetch QR code for a single table via standard write endpoint."""
    return service.generate_qr(
        db,
        _require_restaurant_context(current_user),
        "table",
        payload.target_number,
        frontend_base_url=_request_frontend_base_url(request),
    )


@router.get("/tables", response_model=QRCodeListResponse)
def list_table_qr(
    request: Request,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
    __: bool = Depends(require_module_access("qr")),
) -> QRCodeListResponse:
    """List all table QR codes for the current restaurant."""
    return service.list_table_qr(
        db,
        _require_restaurant_context(current_user),
        frontend_base_url=_request_frontend_base_url(request),
    )


@router.delete("/table/{table_number}", response_model=QRCodeDeleteResponse)
def delete_table_qr(
    table_number: str,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
    __: bool = Depends(require_module_access("qr")),
) -> QRCodeDeleteResponse:
    """Delete one table QR code and its file if present."""
    return service.delete_table_qr(
        db,
        _require_restaurant_context(current_user),
        table_number,
    )


@router.delete("/tables", response_model=QRCodeDeleteResponse)
def delete_all_table_qr(
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
    __: bool = Depends(require_module_access("qr")),
) -> QRCodeDeleteResponse:
    """Delete all table QR codes and files for the current restaurant."""
    return service.delete_all_table_qr(db, _require_restaurant_context(current_user))


@router.get("/room/{room_number}", response_model=QRCodeResponse)
def get_room_qr(
    room_number: str,
    request: Request,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
    __: bool = Depends(require_module_access("qr")),
) -> QRCodeResponse:
    """Generate or fetch QR code for a room."""
    return service.generate_qr(
        db,
        _require_restaurant_context(current_user),
        "room",
        room_number,
        frontend_base_url=_request_frontend_base_url(request),
    )


@router.post("/tables/bulk", response_model=BulkQRCodeResponse)
def bulk_table_qr(
    payload: BulkQRRequest,
    request: Request,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
    __: bool = Depends(require_module_access("qr")),
) -> BulkQRCodeResponse:
    """Generate QR codes for a range of tables."""
    return service.generate_bulk_table_qr(
        db,
        _require_restaurant_context(current_user),
        payload.start,
        payload.end,
        frontend_base_url=_request_frontend_base_url(request),
    )


@router.post("/rooms/bulk", response_model=BulkQRCodeResponse)
def bulk_room_qr(
    payload: RoomBulkQRRequest,
    request: Request,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
    __: bool = Depends(require_module_access("qr")),
) -> BulkQRCodeResponse:
    """Generate QR codes for an explicit list of existing rooms."""
    return service.generate_bulk_room_qr(
        db,
        _require_restaurant_context(current_user),
        payload.room_numbers,
        frontend_base_url=_request_frontend_base_url(request),
    )


@router.post("/tables/rebuild-links", response_model=QRRebuildResponse)
def rebuild_table_qr_links(
    request: Request,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
    __: bool = Depends(require_module_access("qr")),
) -> QRRebuildResponse:
    """Refresh all existing table QR links/images using the current frontend host."""
    refreshed_count, total_count = service.rebuild_qr_links_by_type(
        db,
        _require_restaurant_context(current_user),
        "table",
        frontend_base_url=_request_frontend_base_url(request),
    )
    return QRRebuildResponse(
        message=f"Refreshed {refreshed_count} of {total_count} table QR code(s).",
        refreshed_count=refreshed_count,
        total_count=total_count,
    )


@router.post("/rooms/rebuild-links", response_model=QRRebuildResponse)
def rebuild_room_qr_links(
    request: Request,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
    __: bool = Depends(require_module_access("qr")),
) -> QRRebuildResponse:
    """Refresh all existing room QR links/images using the current frontend host."""
    refreshed_count, total_count = service.rebuild_qr_links_by_type(
        db,
        _require_restaurant_context(current_user),
        "room",
        frontend_base_url=_request_frontend_base_url(request),
    )
    return QRRebuildResponse(
        message=f"Refreshed {refreshed_count} of {total_count} room QR code(s).",
        refreshed_count=refreshed_count,
        total_count=total_count,
    )


@router.get("/rooms", response_model=QRCodeListResponse)
def list_room_qr(
    request: Request,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
    __: bool = Depends(require_module_access("qr")),
) -> QRCodeListResponse:
    """List all room QR codes for the current restaurant."""
    return service.list_room_qr(
        db,
        _require_restaurant_context(current_user),
        frontend_base_url=_request_frontend_base_url(request),
    )


@router.delete("/room/{room_number}", response_model=QRCodeDeleteResponse)
def delete_room_qr(
    room_number: str,
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
    __: bool = Depends(require_module_access("qr")),
) -> QRCodeDeleteResponse:
    """Delete one room QR code and its file if present."""
    return service.delete_room_qr(
        db,
        _require_restaurant_context(current_user),
        room_number,
    )


@router.delete("/rooms", response_model=QRCodeDeleteResponse)
def delete_all_room_qr(
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
    __: bool = Depends(require_module_access("qr")),
) -> QRCodeDeleteResponse:
    """Delete all room QR codes and files for the current restaurant."""
    return service.delete_all_room_qr(db, _require_restaurant_context(current_user))
