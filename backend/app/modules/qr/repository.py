from sqlalchemy.orm import Session

from app.modules.qr.model import QRCode


def get_qr(
    db: Session, restaurant_id: int, qr_type: str, target_number: str
) -> QRCode | None:
    """Fetch existing QR record for restaurant + type + target combination."""
    return (
        db.query(QRCode)
        .filter(
            QRCode.restaurant_id == restaurant_id,
            QRCode.qr_type == qr_type,
            QRCode.target_number == target_number,
        )
        .first()
    )


def create_qr(
    db: Session,
    restaurant_id: int,
    qr_type: str,
    target_number: str,
    file_path: str,
    frontend_url: str,
) -> QRCode:
    """Persist QR code metadata."""
    qr = QRCode(
        restaurant_id=restaurant_id,
        qr_type=qr_type,
        target_number=target_number,
        file_path=file_path,
        frontend_url=frontend_url,
    )
    db.add(qr)
    db.commit()
    db.refresh(qr)
    return qr


def upsert_qr(
    db: Session,
    restaurant_id: int,
    qr_type: str,
    target_number: str,
    file_path: str,
    frontend_url: str,
) -> QRCode:
    """Return existing QR record or create a new one.

    If a QR already exists for the same (restaurant_id, qr_type, target_number),
    the existing record is returned to avoid generating duplicate files.
    """
    existing = get_qr(db, restaurant_id, qr_type, target_number)
    if existing:
        if existing.frontend_url != frontend_url or existing.file_path != file_path:
            existing.frontend_url = frontend_url
            existing.file_path = file_path
            db.commit()
            db.refresh(existing)
        return existing
    return create_qr(db, restaurant_id, qr_type, target_number, file_path, frontend_url)


def list_qr_by_type(
    db: Session,
    restaurant_id: int,
    qr_type: str,
) -> list[QRCode]:
    """Return all QR records for the given restaurant and type."""
    return (
        db.query(QRCode)
        .filter(
            QRCode.restaurant_id == restaurant_id,
            QRCode.qr_type == qr_type,
        )
        .order_by(QRCode.target_number.asc())
        .all()
    )


def delete_qr(
    db: Session,
    restaurant_id: int,
    qr_type: str,
    target_number: str,
) -> QRCode | None:
    """Delete one QR record and return the deleted row metadata."""
    qr_record = get_qr(db, restaurant_id, qr_type, target_number)
    if not qr_record:
        return None
    db.delete(qr_record)
    db.commit()
    return qr_record


def delete_qr_by_type(
    db: Session,
    restaurant_id: int,
    qr_type: str,
) -> list[QRCode]:
    """Delete all QR records for restaurant + type and return deleted rows."""
    records = list_qr_by_type(db, restaurant_id, qr_type)
    if not records:
        return []
    for record in records:
        db.delete(record)
    db.commit()
    return records
