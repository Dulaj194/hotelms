"""Canonical role groups for access control checks.

Keep role collections centralized to avoid drift between routers/services.
"""

from __future__ import annotations

from app.modules.users.model import UserRole

RESTAURANT_ADMIN_ROLES: tuple[UserRole, ...] = (
    UserRole.owner,
    UserRole.admin,
)

RESTAURANT_STAFF_LOGIN_ROLES: tuple[UserRole, ...] = (
    UserRole.steward,
    UserRole.housekeeper,
    UserRole.cashier,
    UserRole.accountant,
)

QR_MENU_STAFF_ROLES: tuple[UserRole, ...] = (
    UserRole.owner,
    UserRole.admin,
    UserRole.steward,
)

HOUSEKEEPING_TASK_ROLES: tuple[UserRole, ...] = (
    UserRole.owner,
    UserRole.admin,
    UserRole.housekeeper,
)

BILLING_STAFF_ROLES: tuple[UserRole, ...] = (
    UserRole.owner,
    UserRole.admin,
    UserRole.steward,
    UserRole.cashier,
    UserRole.accountant,
)

BILLING_ROOM_HANDOFF_TO_CASHIER_ROLES: tuple[UserRole, ...] = (
    UserRole.owner,
    UserRole.admin,
    UserRole.steward,
)

BILLING_ROOM_HANDOFF_TO_ACCOUNTANT_ROLES: tuple[UserRole, ...] = (
    UserRole.owner,
    UserRole.admin,
    UserRole.cashier,
)

BILLING_CASHIER_REVIEW_ROLES: tuple[UserRole, ...] = (
    UserRole.owner,
    UserRole.admin,
    UserRole.cashier,
)

BILLING_ACCOUNTANT_REVIEW_ROLES: tuple[UserRole, ...] = (
    UserRole.owner,
    UserRole.admin,
    UserRole.accountant,
)

BILLING_ROOM_HANDOFF_COMPLETE_ROLES: tuple[UserRole, ...] = (
    UserRole.owner,
    UserRole.admin,
    UserRole.accountant,
)

BILLING_ROOM_REOPEN_ROLES: tuple[UserRole, ...] = (
    UserRole.owner,
    UserRole.admin,
    UserRole.accountant,
)

RESETTABLE_RESTAURANT_STAFF_ROLES: frozenset[UserRole] = frozenset(
    {
        UserRole.owner,
        UserRole.admin,
    }
)
