"""Role hierarchy and management permissions.

Centralized definitions for:
- Which roles can manage which other roles
- Default assigned areas for each role
- Allowed assigned areas per role
"""
from app.modules.users.model import UserRole


# ============================================================================
# ROLE MANAGEMENT HIERARCHY
# ============================================================================
# Defines which roles a given manager role is allowed to create/modify/delete.
#
# Rules:
# - super_admin  → can manage owner, admin, steward, housekeeper, cashier, accountant
# - owner        → can manage admin, steward, housekeeper, cashier, accountant
# - admin        → can manage steward, housekeeper, cashier, accountant
# - steward/housekeeper → no management rights (enforced at router level too)
#
# This is a hierarchical permission model where higher roles can manage
# all lower roles (plus their own level for owner).

MANAGEABLE_ROLES: dict[str, set[UserRole]] = {
    "super_admin": {
        UserRole.owner,
        UserRole.admin,
        UserRole.steward,
        UserRole.housekeeper,
        UserRole.cashier,
        UserRole.accountant,
    },
    "owner": {
        UserRole.admin,
        UserRole.steward,
        UserRole.housekeeper,
        UserRole.cashier,
        UserRole.accountant,
    },
    "admin": {
        UserRole.steward,
        UserRole.housekeeper,
        UserRole.cashier,
        UserRole.accountant,
    },
}


# ============================================================================
# DEFAULT AND ALLOWED ASSIGNED AREAS
# ============================================================================
# Defines the area/department assignments for each role.
#
# - DEFAULT_ASSIGNED_AREAS: The area automatically assigned to this role
# - ALLOWED_ASSIGNED_AREAS: Set of areas this role can be assigned to
#
# Area codes:
# - None: No assignment (owner, admin, super_admin)
# - "steward": Steward department
# - "housekeeper"/"housekeeping": Room/housekeeping department
# - "cashier": Cashier/billing department
# - "accountant"/"accounting": Accounting department
# - "kitchen": Kitchen operations

DEFAULT_ASSIGNED_AREAS: dict[UserRole, str | None] = {
    UserRole.owner: None,
    UserRole.admin: None,
    UserRole.steward: "steward",
    UserRole.housekeeper: "housekeeping",
    UserRole.cashier: "cashier",
    UserRole.accountant: "accounting",
    UserRole.super_admin: None,
}

ALLOWED_ASSIGNED_AREAS: dict[UserRole, set[str | None]] = {
    UserRole.owner: {None},
    UserRole.admin: {None},
    UserRole.steward: {None, "steward", "kitchen"},
    UserRole.housekeeper: {None, "housekeeping"},
    UserRole.cashier: {None, "cashier"},
    UserRole.accountant: {None, "accounting"},
    UserRole.super_admin: {None},
}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def can_manage_role(manager_role: UserRole | str, target_role: UserRole | str) -> bool:
    """Check if a manager role is allowed to manage a target role.

    Args:
        manager_role: The role doing the managing (UserRole or string)
        target_role: The target role being managed (UserRole or string)

    Returns:
        True if manager can manage target, False otherwise
    """
    manager_key = manager_role.value if isinstance(manager_role, UserRole) else manager_role
    manageable = MANAGEABLE_ROLES.get(manager_key, set())
    
    if isinstance(target_role, str):
        try:
            target_role = UserRole(target_role)
        except ValueError:
            return False
    
    return target_role in manageable


def get_default_assigned_area(role: UserRole | str) -> str | None:
    """Get the default assigned area for a role.

    Args:
        role: The role (UserRole or string)

    Returns:
        The default assigned area code, or None
    """
    if isinstance(role, str):
        try:
            role = UserRole(role)
        except ValueError:
            return None
    return DEFAULT_ASSIGNED_AREAS.get(role)


def is_allowed_assigned_area(role: UserRole | str, area: str | None) -> bool:
    """Check if an assigned area is allowed for a role.

    Args:
        role: The role (UserRole or string)
        area: The assigned area code to check

    Returns:
        True if area is allowed for this role, False otherwise
    """
    if isinstance(role, str):
        try:
            role = UserRole(role)
        except ValueError:
            return False
    
    allowed_areas = ALLOWED_ASSIGNED_AREAS.get(role, {None})
    return area in allowed_areas


def get_allowed_assigned_areas(role: UserRole | str) -> set[str | None]:
    """Get all allowed assigned areas for a role.

    Args:
        role: The role (UserRole or string)

    Returns:
        Set of allowed area codes
    """
    if isinstance(role, str):
        try:
            role = UserRole(role)
        except ValueError:
            return {None}
    return ALLOWED_ASSIGNED_AREAS.get(role, {None})
