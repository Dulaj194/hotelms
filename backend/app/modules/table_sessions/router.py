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
    TableServiceRequestPayload,
    ServiceRequestListResponse,
)

router = APIRouter()

_STAFF_ROLES = role_catalog.BILLING_STAFF_ROLES


@router.get("/my", response_model=TableSessionStartResponse)
def get_my_session(
    session: TableSession = Depends(get_current_guest_session),
    db: Session = Depends(get_db),
) -> TableSessionStartResponse:
    """Return the current guest session info.
    
    Used by the frontend to check session_status and expires_at.
    """
    bill_total = None
    if session.session_status in {TableSessionStatus.BILL_PRESENTED, TableSessionStatus.BILL_CONFIRMED}:
        from app.modules.orders.repository import list_billable_orders_by_session
        billable = list_billable_orders_by_session(db, session.session_id)
        bill_total = float(sum(order.total_amount for order in billable))

    return TableSessionStartResponse(
        session_id=session.session_id,
        guest_token="",
        restaurant_id=session.restaurant_id,
        table_number=session.table_number,
        customer_name=session.customer_name or "Guest",
        order_source=session.order_source,
        session_status=session.session_status,
        bill_total=bill_total,
        expires_at=session.expires_at,
    )


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
    payload: TableServiceRequestPayload,
    session: TableSession = Depends(get_current_guest_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
):
    """Request a specific service (Water, Steward, etc.) at the table."""
    service.request_service(db, r, session, payload.service_type, payload.message)
    return {"message": f"Request for {payload.service_type} sent to staff."}


@router.get("/service-requests", response_model=ServiceRequestListResponse)
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


@router.patch("/service-requests/{request_id}/acknowledge")
def acknowledge_service_request(
    request_id: int,
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
    restaurant_id: int = Depends(get_current_restaurant_id),
    current_user=Depends(require_roles(*_STAFF_ROLES)),
):
    """Mark a service request as acknowledged by the current staff member."""
    success = service.acknowledge_service_request(db, r, request_id, restaurant_id, current_user.id)
    if not success:
        return {"error": "Request not found"}, 404
    return {"message": "Service request acknowledged."}


@router.patch("/bill-requests/{session_id}/acknowledge")
def acknowledge_bill(
    session_id: str,
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
    restaurant_id: int = Depends(get_current_restaurant_id),
    current_user=Depends(require_roles(*_STAFF_ROLES)),
):
    """Mark a bill request as acknowledged."""
    success = service.acknowledge_bill(db, r, session_id, restaurant_id, current_user.id)
    if not success:
        return {"error": "Bill request not found or already acknowledged"}, 404
    return {"message": "Bill request acknowledged."}


@router.patch("/bill-requests/{session_id}/present")
def present_bill(
    session_id: str,
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _current_user=Depends(require_roles(*_STAFF_ROLES)),
):
    """Present the bill to the customer (triggers popup on their phone)."""
    success = service.present_bill(db, r, session_id, restaurant_id)
    if not success:
        return {"error": "Session not found"}, 404
    return {"message": "Bill presented to customer."}


@router.patch("/my/confirm-bill")
def confirm_bill(
    session: TableSession = Depends(get_current_guest_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
):
    """Guest confirms the presented bill."""
    service.confirm_bill(db, r, session)
    return {"message": "Bill confirmed."}


@router.delete("/service-requests/{request_id}")
def resolve_service_request(
    request_id: int,
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _current_user=Depends(require_roles(*_STAFF_ROLES)),
):
    """Mark a service request as resolved/completed."""
    success = service.resolve_service_request(db, r, request_id, restaurant_id)
    if not success:
        return {"error": "Request not found"}, 404
    return {"message": "Request marked as resolved."}
