from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.modules.users.model import User
from app.modules.users.schemas import UserCreate

# ─── Global access (auth flows and super_admin only) ──────────────────────────
#
# SECURITY: These methods bypass tenant scoping and must ONLY be used for:
#   - Authentication flows (login, token refresh) where a global user lookup
#     is required before tenant context can be established.
#   - super_admin operations that intentionally cross tenant boundaries.
# Do NOT call these from tenant-scoped business logic.


def get_by_id_global(db: Session, user_id: int) -> User | None:
    """Fetch a user by ID without tenant scoping.

    Use ONLY for auth flows (token refresh) or super_admin operations.
    For tenant-scoped user access, use get_by_id(db, user_id, restaurant_id).
    """
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> User | None:
    """Fetch a user by email without tenant scoping.

    Used for login — email uniqueness is enforced globally, so no
    tenant scope is needed here. This is the only legitimate cross-tenant
    email lookup.
    """
    return db.query(User).filter(User.email == email).first()


def list_all_for_super_admin(db: Session) -> list[User]:
    """List all users across all tenants. Use ONLY in super_admin endpoints."""
    return db.query(User).all()


# ─── Tenant-safe access ───────────────────────────────────────────────────────
#
# SECURITY: These methods explicitly require restaurant_id so the caller is
# forced to supply the authenticated tenant context at the call site.
# Cross-tenant access is structurally impossible through these methods.


def get_by_id(db: Session, user_id: int, restaurant_id: int) -> User | None:
    """Fetch a user by ID scoped to a specific restaurant.

    restaurant_id must come from the authenticated context (dependency injected),
    never from a client-supplied request body or query parameter.
    """
    return (
        db.query(User)
        .filter(User.id == user_id, User.restaurant_id == restaurant_id)
        .first()
    )


def list_by_restaurant(db: Session, restaurant_id: int) -> list[User]:
    """List all users belonging to a specific restaurant.

    restaurant_id must come from the authenticated context.
    """
    return db.query(User).filter(User.restaurant_id == restaurant_id).all()


# ─── Write operations ─────────────────────────────────────────────────────────


def create_user(db: Session, data: UserCreate) -> User:
    user = User(
        full_name=data.full_name,
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role,
        restaurant_id=data.restaurant_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_last_login(db: Session, user: User) -> None:
    user.last_login_at = datetime.now(UTC)
    db.commit()


def update_password(db: Session, user: User, new_password_hash: str) -> None:
    user.password_hash = new_password_hash
    db.commit()
