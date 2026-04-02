"""Billing router for table settlements, room folios, and review dashboards."""
from __future__ import annotations

from datetime import date

import redis as redis_lib
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_restaurant_id,
    get_db,
    get_redis,
    require_module_access,
    require_roles,
)
from app.modules.billing import service as billing_service
from app.modules.billing.model import BillContextType, BillHandoffStatus, BillReviewStatus
from app.modules.billing.schemas import (
    BillDetailResponse,
    BillListResponse,
    BillRecordResponse,
    BillingQueueSummaryResponse,
    BillingReconciliationResponse,
    BillSummaryResponse,
    BillWorkflowActionRequest,
    BillWorkflowEventListResponse,
    SessionBillingStatusResponse,
    SessionPaymentHistoryResponse,
    SettleSessionRequest,
    SettleSessionResponse,
)

router = APIRouter()

_STAFF_ROLES = ["owner", "admin", "steward", "cashier", "accountant"]
_ROOM_HANDOFF_TO_CASHIER_ROLES = ["owner", "admin", "steward"]
_ROOM_HANDOFF_TO_ACCOUNTANT_ROLES = ["owner", "admin", "cashier"]
_CASHIER_REVIEW_ROLES = ["owner", "admin", "cashier"]
_ACCOUNTANT_REVIEW_ROLES = ["owner", "admin", "accountant"]
_ROOM_HANDOFF_COMPLETE_ROLES = ["owner", "admin", "accountant"]
_ROOM_REOPEN_ROLES = ["owner", "admin", "accountant"]


@router.get(
    "/session/{session_id}/summary",
    response_model=BillSummaryResponse,
    summary="Get bill summary for a table session",
)
def get_bill_summary(
    session_id: str,
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _current_user=Depends(require_roles(*_STAFF_ROLES)),
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
    r: redis_lib.Redis = Depends(get_redis),
    restaurant_id: int = Depends(get_current_restaurant_id),
    current_user=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.settle_session(
        db,
        session_id,
        restaurant_id,
        payload,
        current_user=current_user,
        r=r,
    )


@router.get(
    "/session/{session_id}/payments",
    response_model=SessionPaymentHistoryResponse,
    summary="List payment records for a table session",
)
def list_session_payments(
    session_id: str,
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _current_user=Depends(require_roles(*_STAFF_ROLES)),
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
    _current_user=Depends(require_roles(*_STAFF_ROLES)),
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
    _current_user=Depends(require_roles(*_STAFF_ROLES)),
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
    r: redis_lib.Redis = Depends(get_redis),
    restaurant_id: int = Depends(get_current_restaurant_id),
    current_user=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.settle_room_session(
        db,
        lookup,
        restaurant_id,
        payload,
        current_user=current_user,
        r=r,
    )


@router.get(
    "/room/{lookup}/payments",
    response_model=SessionPaymentHistoryResponse,
    summary="List payment records for a room folio",
)
def list_room_session_payments(
    lookup: str,
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _current_user=Depends(require_roles(*_STAFF_ROLES)),
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
    _current_user=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.get_room_billing_status(db, lookup, restaurant_id)


@router.get(
    "/queue-summary",
    response_model=BillingQueueSummaryResponse,
    summary="Get room-folio queue totals for billing dashboards",
)
def get_billing_queue_summary(
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _current_user=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.get_billing_queue_summary(
        db,
        restaurant_id=restaurant_id,
    )


@router.get(
    "/events",
    response_model=BillWorkflowEventListResponse,
    summary="List billing workflow events",
)
def list_bill_workflow_events(
    bill_id: int | None = Query(default=None),
    action_type: str | None = Query(default=None),
    created_from: date | None = Query(default=None),
    created_to: date | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=250),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _current_user=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.list_bill_workflow_events(
        db,
        restaurant_id=restaurant_id,
        bill_id=bill_id,
        action_type=action_type,
        created_from=created_from,
        created_to=created_to,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/reconciliation/daily",
    response_model=BillingReconciliationResponse,
    summary="Get end-of-day billing reconciliation snapshot",
)
def get_daily_reconciliation(
    business_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _current_user=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.get_daily_reconciliation(
        db,
        restaurant_id=restaurant_id,
        business_date=business_date,
    )


@router.get(
    "/folios",
    response_model=BillListResponse,
    summary="List bills or room folios",
)
def list_folios(
    context_type: BillContextType | None = Query(default=None),
    handoff_status: BillHandoffStatus | None = Query(default=None),
    cashier_status: BillReviewStatus | None = Query(default=None),
    accountant_status: BillReviewStatus | None = Query(default=None),
    search: str | None = Query(default=None),
    settled_from: date | None = Query(default=None),
    settled_to: date | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=250),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _current_user=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.list_folios(
        db,
        restaurant_id=restaurant_id,
        context_type=context_type,
        handoff_status=handoff_status,
        cashier_status=cashier_status,
        accountant_status=accountant_status,
        search=search,
        settled_from=settled_from,
        settled_to=settled_to,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/folios/{bill_id}",
    response_model=BillDetailResponse,
    summary="Get a detailed folio with payment and audit history",
)
def get_folio_detail(
    bill_id: int,
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _current_user=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.get_folio_detail(
        db,
        bill_id=bill_id,
        restaurant_id=restaurant_id,
    )


@router.post(
    "/folios/{bill_id}/print",
    response_model=BillRecordResponse,
    summary="Record a bill print action for audit history",
)
def record_bill_print(
    bill_id: int,
    payload: BillWorkflowActionRequest | None = None,
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
    restaurant_id: int = Depends(get_current_restaurant_id),
    current_user=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.record_bill_print(
        db,
        bill_id=bill_id,
        restaurant_id=restaurant_id,
        current_user=current_user,
        note=payload.note if payload else None,
        r=r,
    )


@router.post(
    "/folios/{bill_id}/send-to-cashier",
    response_model=BillRecordResponse,
    summary="Send a settled room folio to cashier",
)
def send_room_folio_to_cashier(
    bill_id: int,
    payload: BillWorkflowActionRequest | None = None,
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
    restaurant_id: int = Depends(get_current_restaurant_id),
    current_user=Depends(require_roles(*_ROOM_HANDOFF_TO_CASHIER_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.send_room_folio_to_cashier(
        db,
        bill_id=bill_id,
        restaurant_id=restaurant_id,
        current_user=current_user,
        note=payload.note if payload else None,
        r=r,
    )


@router.post(
    "/folios/{bill_id}/cashier/accept",
    response_model=BillRecordResponse,
    summary="Accept a room folio in the cashier queue",
)
def accept_cashier_folio(
    bill_id: int,
    payload: BillWorkflowActionRequest | None = None,
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
    restaurant_id: int = Depends(get_current_restaurant_id),
    current_user=Depends(require_roles(*_CASHIER_REVIEW_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.accept_cashier_folio(
        db,
        bill_id=bill_id,
        restaurant_id=restaurant_id,
        current_user=current_user,
        note=payload.note if payload else None,
        r=r,
    )


@router.post(
    "/folios/{bill_id}/cashier/reject",
    response_model=BillRecordResponse,
    summary="Reject a room folio back to the billing workspace",
)
def reject_cashier_folio(
    bill_id: int,
    payload: BillWorkflowActionRequest | None = None,
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
    restaurant_id: int = Depends(get_current_restaurant_id),
    current_user=Depends(require_roles(*_CASHIER_REVIEW_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.reject_cashier_folio(
        db,
        bill_id=bill_id,
        restaurant_id=restaurant_id,
        current_user=current_user,
        note=payload.note if payload else None,
        r=r,
    )


@router.post(
    "/folios/{bill_id}/send-to-accountant",
    response_model=BillRecordResponse,
    summary="Send a settled room folio from cashier to accountant",
)
def send_room_folio_to_accountant(
    bill_id: int,
    payload: BillWorkflowActionRequest | None = None,
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
    restaurant_id: int = Depends(get_current_restaurant_id),
    current_user=Depends(require_roles(*_ROOM_HANDOFF_TO_ACCOUNTANT_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.send_room_folio_to_accountant(
        db,
        bill_id=bill_id,
        restaurant_id=restaurant_id,
        current_user=current_user,
        note=payload.note if payload else None,
        r=r,
    )


@router.post(
    "/folios/{bill_id}/accountant/accept",
    response_model=BillRecordResponse,
    summary="Accept a room folio in the accountant queue",
)
def accept_accountant_folio(
    bill_id: int,
    payload: BillWorkflowActionRequest | None = None,
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
    restaurant_id: int = Depends(get_current_restaurant_id),
    current_user=Depends(require_roles(*_ACCOUNTANT_REVIEW_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.accept_accountant_folio(
        db,
        bill_id=bill_id,
        restaurant_id=restaurant_id,
        current_user=current_user,
        note=payload.note if payload else None,
        r=r,
    )


@router.post(
    "/folios/{bill_id}/accountant/reject",
    response_model=BillRecordResponse,
    summary="Reject a room folio back to the cashier queue",
)
def reject_accountant_folio(
    bill_id: int,
    payload: BillWorkflowActionRequest | None = None,
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
    restaurant_id: int = Depends(get_current_restaurant_id),
    current_user=Depends(require_roles(*_ACCOUNTANT_REVIEW_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.reject_accountant_folio(
        db,
        bill_id=bill_id,
        restaurant_id=restaurant_id,
        current_user=current_user,
        note=payload.note if payload else None,
        r=r,
    )


@router.post(
    "/folios/{bill_id}/complete",
    response_model=BillRecordResponse,
    summary="Mark a room folio handoff as completed",
)
def complete_room_folio_handoff(
    bill_id: int,
    payload: BillWorkflowActionRequest | None = None,
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
    restaurant_id: int = Depends(get_current_restaurant_id),
    current_user=Depends(require_roles(*_ROOM_HANDOFF_COMPLETE_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.complete_room_folio_handoff(
        db,
        bill_id=bill_id,
        restaurant_id=restaurant_id,
        current_user=current_user,
        note=payload.note if payload else None,
        r=r,
    )


@router.post(
    "/folios/{bill_id}/reopen",
    response_model=BillRecordResponse,
    summary="Reopen a completed room folio back to fresh queue",
)
def reopen_room_folio(
    bill_id: int,
    payload: BillWorkflowActionRequest | None = None,
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
    restaurant_id: int = Depends(get_current_restaurant_id),
    current_user=Depends(require_roles(*_ROOM_REOPEN_ROLES)),
    __=Depends(require_module_access("billing")),
):
    return billing_service.reopen_room_folio(
        db,
        bill_id=bill_id,
        restaurant_id=restaurant_id,
        current_user=current_user,
        note=payload.note if payload else None,
        r=r,
    )
