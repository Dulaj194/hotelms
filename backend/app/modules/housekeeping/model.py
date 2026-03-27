"""Housekeeping ORM models."""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class RequestStatus(str, enum.Enum):
    """Task lifecycle status for housekeeping execution."""

    pending_assignment = "pending_assignment"
    assigned = "assigned"
    in_progress = "in_progress"
    inspection = "inspection"
    ready = "ready"
    blocked = "blocked"
    rework_required = "rework_required"
    cancelled = "cancelled"

    # Legacy aliases kept for backward compatibility with old rows.
    pending = "pending"
    done = "done"


class RequestType(str, enum.Enum):
    cleaning = "cleaning"
    towels = "towels"
    water = "water"
    maintenance = "maintenance"
    other = "other"


class RequestPriority(str, enum.Enum):
    high = "high"
    normal = "normal"
    low = "low"


class HousekeepingRequest(Base):
    """Housekeeping task/request raised for a room."""

    __tablename__ = "housekeeping_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    restaurant_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    room_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("rooms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Guest/session context for public room requests
    room_session_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    room_number_snapshot: Mapped[str] = mapped_column(String(50), nullable=False)
    guest_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    request_type: Mapped[RequestType] = mapped_column(
        Enum(RequestType, native_enum=False),
        nullable=False,
        index=True,
    )
    priority: Mapped[RequestPriority] = mapped_column(
        Enum(RequestPriority, native_enum=False),
        nullable=False,
        default=RequestPriority.normal,
        server_default=RequestPriority.normal.value,
        index=True,
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    requested_for_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    audio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    photo_proof_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    status: Mapped[RequestStatus] = mapped_column(
        Enum(RequestStatus, native_enum=False),
        nullable=False,
        default=RequestStatus.pending_assignment,
        server_default=RequestStatus.pending_assignment.value,
        index=True,
    )

    assigned_to_user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_by_user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    inspection_submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    inspected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    inspected_by_user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    inspection_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    blocked_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    delay_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    rework_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    sla_breached: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")

    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    checklist_items: Mapped[list["HousekeepingChecklistItem"]] = relationship(
        "HousekeepingChecklistItem",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    maintenance_tickets: Mapped[list["HousekeepingMaintenanceTicket"]] = relationship(
        "HousekeepingMaintenanceTicket",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    event_logs: Mapped[list["HousekeepingEventLog"]] = relationship(
        "HousekeepingEventLog",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class HousekeepingChecklistItem(Base):
    __tablename__ = "housekeeping_checklist_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    request_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("housekeeping_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item_code: Mapped[str] = mapped_column(String(50), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_by_user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class HousekeepingMaintenanceTicket(Base):
    __tablename__ = "housekeeping_maintenance_tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    request_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("housekeeping_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    restaurant_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    room_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("rooms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    issue_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    photo_proof_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open", server_default="open", index=True)
    created_by_user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    resolved_by_user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class HousekeepingEventLog(Base):
    __tablename__ = "housekeeping_event_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    request_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("housekeeping_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    restaurant_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    from_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
