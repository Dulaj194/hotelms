from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class ReportHistory(Base):
    __tablename__ = "reports_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    restaurant_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    generated_by_user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    report_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    output_format: Mapped[str] = mapped_column(String(20), nullable=False, default="json", server_default="json")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="generated", server_default="generated")
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    report_params_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_data_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
