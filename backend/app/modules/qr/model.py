from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class QRCode(Base):
    """Persisted QR code metadata.

    One record per (restaurant_id, qr_type, target_number) combination.
    When a QR is requested again for the same combination, the existing
    file is reused unless regeneration is forced.
    """

    __tablename__ = "qrcodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Tenant scope — derived from authenticated context, never from client.
    restaurant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # "table" or "room"
    qr_type: Mapped[str] = mapped_column(String(20), nullable=False)

    # Table or room number as a string (e.g. "5", "203")
    target_number: Mapped[str] = mapped_column(String(50), nullable=False)

    # Server-relative path to the PNG file under uploads/qrcodes/
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)

    # The frontend URL encoded in the QR
    frontend_url: Mapped[str] = mapped_column(String(1000), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("restaurant_id", "qr_type", "target_number", name="uq_qr_restaurant_type_target"),
    )
