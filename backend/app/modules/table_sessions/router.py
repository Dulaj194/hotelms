import redis as redis_lib
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_guest_session,
    get_current_restaurant_id,
    get_db,
    get_redis,
    require_roles,
)
from app.modules.access import role_catalog
from app.modules.table_sessions import service
from app.modules.table_sessions.model import TableSession
from app.modules.table_sessions.schemas import (
    BillRequestListResponse,
    TableSessionStartRequest,
    TableSessionStartResponse,
    TableServiceRequest,
)

router = APIRouter()

_STAFF_ROLES = role_catalog.BILLING_STAFF_ROLES


@router.post("/start", response_model=TableSessionStartResponse)
def start_session(
    payload: TableSessionStartRequest,
    db: Session = Depends(get_db),
) -> TableSessionStartResponse:
    """Start a guest table session from a QR scan context.

    Public endpoint — no login required.

    SECURITY: Returns a signed guest_token. All subsequent cart operations
    require this token via X-Guest-Session header. Table number alone is
    never sufficient for cart authorization.
    """
    return service.start_table_session(db, payload)


@router.post("/my/request-bill")
def request_bill(
    session: TableSession = Depends(get_current_guest_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
):
    """Notify staff that the guest is ready for the bill."""
    service.request_bill(db, r, session)
    return {"message": "Bill request sent to staff."}


@router.get("/bill-requests", response_model=BillRequestListResponse)
def list_bill_requests(
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _current_user=Depends(require_roles(*_STAFF_ROLES)),
):
    """List all active table sessions requesting a bill.

    STAFF ONLY endpoint.
    """
    sessions = service.list_bill_requests(db, restaurant_id)
    return {"requests": sessions}

@router.post("/my/request-service")
def request_service(
    payload: TableServiceRequest,
    session: TableSession = Depends(get_current_guest_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
):
    """Request a specific service (Water, Steward, etc.) at the table."""
    service.request_service(db, r, session, payload.service_type, payload.message)
    return {"message": f"Request for {payload.service_type} sent to staff."}

@router.get("/service-requests")
def list_service_requests(
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _current_user=Depends(require_roles(*_STAFF_ROLES)),
):
    """List all active table service requests (Water, etc.).
    
    STAFF ONLY endpoint.
    """
    requests = service.list_service_requests(db, restaurant_id)
    return {"requests": requests}


@router.delete("/service-requests/{request_id}")
def resolve_service_request(
    request_id: int,
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _current_user=Depends(require_roles(*_STAFF_ROLES)),
):
    """Mark a service request as resolved/completed."""
    success = service.resolve_service_request(db, request_id, restaurant_id)
    if not success:
        return {"error": "Request not found"}, 404
    return {"message": "Request marked as resolved."}
