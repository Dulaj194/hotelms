"""Billing router — all billing HTTP endpoints.

Endpoints (prefix /api/v1/billing):
  GET  /session/{session_id}/summary   — Bill summary for a table session
  POST /session/{session_id}/settle    — Settle / close the session
  GET  /session/{session_id}/payments  — Payment records for the session
  GET  /session/{session_id}/status    — Quick billing status snapshot

All endpoints require authenticated staff with role: owner | admin | steward.
The restaurant_id is derived from the JWT token, never from the client request.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_restaurant_id, require_roles
from app.db.session import get_db
from app.modules.billing import service as billing_service
from app.modules.billing.schemas import (
    BillSummaryResponse,
    SessionBillingStatusResponse,
    SessionPaymentHistoryResponse,
    SettleSessionRequest,
    SettleSessionResponse,
)

router = APIRouter()

_STAFF_ROLES = ["owner", "admin", "steward"]


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
):
    return billing_service.get_bill_summary(db, session_id, restaurant_id)


@router.post(
    "/session/{session_id}/settle",
    response_model=SettleSessionResponse,
    status_code=200,
    summary="Settle (close and pay) a table session",
)
def settle_session(
    session_id: str,
    payload: SettleSessionRequest,
    db: Session = Depends(get_db),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _=Depends(require_roles(*_STAFF_ROLES)),
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
):
    return billing_service.get_session_billing_status(db, session_id, restaurant_id)

