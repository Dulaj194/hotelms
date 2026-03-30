"""
SQLAlchemy models package.
Canonical model exports live here so `from app.models import ...` works reliably.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, foreign, relationship

Base = declarative_base()


class SuperAdmin(Base):
    """Platform-level super admin."""

    __tablename__ = "super_admin_tbl"

    super_admin_id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # actor_id has no explicit FK (it can reference multiple actor tables), so
    # this relationship is view-only and uses an explicit join condition.
    audit_logs = relationship(
        "AuditLog",
        primaryjoin="foreign(AuditLog.actor_id) == SuperAdmin.super_admin_id",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return f"<SuperAdmin {self.email}>"


class SubscriptionStatus(str, enum.Enum):
    """Restaurant subscription states."""

    TRIAL = "trial"
    ACTIVE = "active"
    PAUSED = "paused"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class Restaurant(Base):
    """Tenant model."""

    __tablename__ = "restaurant_tbl"

    restaurant_id = Column(Integer, primary_key=True)
    restaurant_name = Column(String(255), nullable=False)
    address = Column(Text)
    contact_number = Column(String(20))
    email = Column(String(255), unique=True, nullable=False, index=True)
    logo = Column(String(255))
    password = Column(String(255), nullable=False)
    opening_time = Column(String(8))
    closing_time = Column(String(8))

    subscription_status = Column(
        Enum(SubscriptionStatus), default=SubscriptionStatus.TRIAL, index=True
    )
    subscription_start_date = Column(DateTime)
    subscription_expiry_date = Column(DateTime)

    currency_code = Column(String(3), default="USD")
    currency_symbol = Column(String(5), default="$")
    timezone = Column(String(50), default="UTC")
    country_code = Column(String(2))

    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    admins = relationship("Admin", back_populates="restaurant", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="restaurant")

    __table_args__ = (Index("idx_status_active", "subscription_status", "is_active"),)

    def __repr__(self) -> str:
        return f"<Restaurant {self.restaurant_name}>"


class AdminRole(str, enum.Enum):
    """Admin/staff roles."""

    OWNER = "owner"
    ADMIN = "admin"
    STEWARD = "steward"
    HOUSEKEEPER = "housekeeper"


class Admin(Base):
    """Restaurant-bound admin/staff model."""

    __tablename__ = "admin_tbl"

    admin_id = Column(Integer, primary_key=True)
    restaurant_id = Column(
        Integer,
        ForeignKey("restaurant_tbl.restaurant_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    phone = Column(String(20))
    role = Column(Enum(AdminRole), default=AdminRole.ADMIN, index=True)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    restaurant = relationship("Restaurant", back_populates="admins")
    audit_logs = relationship(
        "AuditLog",
        primaryjoin="foreign(AuditLog.actor_id) == Admin.admin_id",
        viewonly=True,
    )

    __table_args__ = (
        UniqueConstraint("restaurant_id", "email", name="uq_restaurant_email"),
    )

    def __repr__(self) -> str:
        return f"<Admin {self.email} ({self.role})>"


class FieldDefinition(Base):
    """Field metadata for field-level access control."""

    __tablename__ = "field_definitions_tbl"

    field_id = Column(Integer, primary_key=True)
    entity_type = Column(String(50), nullable=False, index=True)
    field_name = Column(String(100), nullable=False)
    field_label = Column(String(100), nullable=False)
    field_type = Column(String(20), nullable=False)
    is_sensitive = Column(Boolean, default=False, index=True)
    is_system = Column(Boolean, default=False)
    display_order = Column(Integer, nullable=False)
    default_requirement = Column(String(20), default="visible")
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("entity_type", "field_name", name="uq_entity_field"),
    )

    def __repr__(self) -> str:
        return f"<FieldDefinition {self.entity_type}.{self.field_name}>"


class RoleFieldPermission(Base):
    """Role-field access mapping."""

    __tablename__ = "role_field_permissions_tbl"

    permission_id = Column(Integer, primary_key=True)
    role_id = Column(String(50), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False)
    field_name = Column(String(100), nullable=False)
    access_level = Column(String(20), default="view_only", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("role_id", "entity_type", "field_name", name="uq_role_entity_field"),
    )

    def __repr__(self) -> str:
        return f"<Permission {self.role_id}.{self.entity_type}.{self.field_name}>"


class AuditLog(Base):
    """Audit log entries (changed values only)."""

    __tablename__ = "audit_log"

    audit_id = Column(Integer, primary_key=True)
    restaurant_id = Column(
        Integer,
        ForeignKey("restaurant_tbl.restaurant_id", ondelete="SET NULL"),
        index=True,
    )

    actor_id = Column(Integer, index=True)
    actor_role = Column(String(50), nullable=False)
    actor_ip = Column(String(45))
    actor_user_agent = Column(String(500))

    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    action = Column(String(50), nullable=False)
    field_name = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    request_id = Column(String(50), index=True)
    changed_at = Column(DateTime, default=datetime.utcnow, index=True)

    restaurant = relationship("Restaurant", back_populates="audit_logs")

    def __repr__(self) -> str:
        return f"<AuditLog {self.entity_type}#{self.entity_id}>"


__all__ = [
    "Base",
    "SuperAdmin",
    "SubscriptionStatus",
    "Restaurant",
    "AdminRole",
    "Admin",
    "FieldDefinition",
    "RoleFieldPermission",
    "AuditLog",
]
