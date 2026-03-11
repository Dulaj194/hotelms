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
        return existing
    return create_qr(db, restaurant_id, qr_type, target_number, file_path, frontend_url)
