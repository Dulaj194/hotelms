import redis as redis_lib
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_redis, get_current_guest_session
from app.modules.table_sessions import service
from app.modules.table_sessions.model import TableSession
from app.modules.table_sessions.schemas import (
    TableSessionStartRequest,
    TableSessionStartResponse,
)

router = APIRouter()


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
