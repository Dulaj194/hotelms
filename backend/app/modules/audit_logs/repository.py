from sqlalchemy.orm import Session

from app.modules.audit_logs.model import AuditLog


def create_log(db: Session, log: AuditLog) -> AuditLog:
    db.add(log)
    db.commit()
    db.refresh(log)
    return log
