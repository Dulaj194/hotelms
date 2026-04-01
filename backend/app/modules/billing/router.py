"""Billing router for table sessions and room folios."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_restaurant_id,
    get_db,
    require_module_access,
    require_roles,
)
from app.modules.billing import service as billing_service
from app.modules.billing.model import BillContextType, BillHandoffStatus
from app.modules.billing.schemas import (
    BillListResponse,
    BillRecordResponse,
    BillSummaryResponse,
    SessionBillingStatusResponse,
    SessionPaymentHistoryResponse,
    SettleSessionRequest,
    SettleSessionResponse,
)

router = APIRouter()

_STAFF_ROLES = ["owner", "admin", "steward", "cashier", "accountant"]
_ROOM_HANDOFF_TO_CASHIER_ROLES = ["owner", "admin", "steward"]
_ROOM_HANDOFF_TO_ACCOUNTANT_ROLES = ["owner", "admin", "cashier"]
_ROOM_HANDOFF_COMPLETE_ROLES = ["owner", "admin", "accountant"]


@router.get(
    "/session/{session_id}/summary",
    response_model=BillSummaryResponse,
    summary="Get bill summary for a table session",
)
def get_bill_summary(
    session_id: str,
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.get_bill_summary(db, session_id, restaurant_id)


@router.post(
    "/session/{session_id}/settle",
    response_model=SettleSessionResponse,
    summary="Settle a table session",
)
def settle_session(
    session_id: str,
    payload: SettleSessionRequest,
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.settle_session(db, session_id, restaurant_id, payload)


@router.get(
    "/session/{session_id}/payments",
    response_model=SessionPaymentHistoryResponse,
    summary="List payment records for a table session",
)
def list_session_payments(
    session_id: str,
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.list_session_payments(db, session_id, restaurant_id)


@router.get(
    "/session/{session_id}/status",
    response_model=SessionBillingStatusResponse,
    summary="Get quick billing status for a table session",
)
def get_session_billing_status(
    session_id: str,
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.get_session_billing_status(db, session_id, restaurant_id)


@router.get(
    "/room/{lookup}/summary",
    response_model=BillSummaryResponse,
    summary="Get folio summary for a room session or room number",
)
def get_room_bill_summary(
    lookup: str,
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.get_room_bill_summary(db, lookup, restaurant_id)


@router.post(
    "/room/{lookup}/settle",
    response_model=SettleSessionResponse,
    summary="Settle a room folio",
)
def settle_room_session(
    lookup: str,
    payload: SettleSessionRequest,
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.settle_room_session(db, lookup, restaurant_id, payload)


@router.get(
    "/room/{lookup}/payments",
    response_model=SessionPaymentHistoryResponse,
    summary="List payment records for a room folio",
)
def list_room_session_payments(
    lookup: str,
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.list_room_session_payments(db, lookup, restaurant_id)


@router.get(
    "/room/{lookup}/status",
    response_model=SessionBillingStatusResponse,
    summary="Get quick billing status for a room folio",
)
def get_room_billing_status(
    lookup: str,
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.get_room_billing_status(db, lookup, restaurant_id)


@router.get(
    "/folios",
    response_model=BillListResponse,
    summary="List bills or room folios",
)
def list_folios(
    context_type: BillContextType | None = Query(default=None),
    handoff_status: BillHandoffStatus | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.list_folios(
        db,
        restaurant_id=restaurant_id,
        context_type=context_type,
        handoff_status=handoff_status,
        limit=limit,
    )


@router.post(
    "/folios/{bill_id}/send-to-cashier",
    response_model=BillRecordResponse,
    summary="Send a settled room folio to cashier",
)
def send_room_folio_to_cashier(
    bill_id: int,
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _=Depends(require_roles(*_ROOM_HANDOFF_TO_CASHIER_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.send_room_folio_to_cashier(
        db,
        bill_id=bill_id,
        restaurant_id=restaurant_id,
    )


@router.post(
    "/folios/{bill_id}/send-to-accountant",
    response_model=BillRecordResponse,
    summary="Send a settled room folio from cashier to accountant",
)
def send_room_folio_to_accountant(
    bill_id: int,
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _=Depends(require_roles(*_ROOM_HANDOFF_TO_ACCOUNTANT_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.send_room_folio_to_accountant(
        db,
        bill_id=bill_id,
        restaurant_id=restaurant_id,
    )


@router.post(
    "/folios/{bill_id}/complete",
    response_model=BillRecordResponse,
    summary="Mark a room folio handoff as completed",
)
def complete_room_folio_handoff(
    bill_id: int,
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _=Depends(require_roles(*_ROOM_HANDOFF_COMPLETE_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.complete_room_folio_handoff(
        db,
        bill_id=bill_id,
        restaurant_id=restaurant_id,
    )
