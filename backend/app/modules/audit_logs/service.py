import json

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.modules.audit_logs.model import AuditLog

logger = get_logger(__name__)


def write_audit_log(
    db: Session,
    event_type: str,
    user_id: int | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    metadata: dict | None = None,
) -> None:
    """Write an audit log entry.

    Failures are caught and logged as warnings so that audit logging
    never interrupts the main application flow.
    """
    try:
        log = AuditLog(
            event_type=event_type,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata_json=json.dumps(metadata) if metadata else None,
        )
        db.add(log)
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.warning("Audit log write failed [%s]: %s", event_type, exc)
