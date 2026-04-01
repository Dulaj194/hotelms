from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.modules.users.model import User, UserRole
from app.modules.users.schemas import StaffCreateRequest, StaffUpdateRequest, UserCreate


# Global access helpers
# Use these only for authentication flows or explicit cross-tenant operations.


def get_by_id_global(db: Session, user_id: int) -> User | None:
    """Fetch a user by ID without tenant scoping."""
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> User | None:
    """Fetch a user by email without tenant scoping."""
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def get_user_by_phone(db: Session, phone: str) -> User | None:
    return db.query(User).filter(User.phone == phone).first()


# Tenant-safe access helpers


def get_by_id(db: Session, user_id: int, restaurant_id: int) -> User | None:
    """Fetch a user by ID scoped to a specific restaurant."""
    return (
        db.query(User)
        .filter(User.id == user_id, User.restaurant_id == restaurant_id)
        .first()
    )


def list_by_restaurant(
    db: Session,
    restaurant_id: int,
    *,
    role: UserRole | None = None,
    is_active: bool | None = None,
) -> list[User]:
    """List users belonging to a specific restaurant."""
    query = db.query(User).filter(User.restaurant_id == restaurant_id)
    if role is not None:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    return query.order_by(User.created_at.desc()).all()


def list_platform_users(
    db: Session,
    *,
    is_active: bool | None = None,
) -> list[User]:
    query = db.query(User).filter(
        User.role == UserRole.super_admin,
        User.restaurant_id.is_(None),
    )
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    return query.order_by(User.created_at.desc(), User.id.desc()).all()


def get_platform_user_by_id(db: Session, user_id: int) -> User | None:
    return (
        db.query(User)
        .filter(
            User.id == user_id,
            User.role == UserRole.super_admin,
            User.restaurant_id.is_(None),
        )
        .first()
    )


# Write operations


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


def create_platform_user(
    db: Session,
    *,
    full_name: str,
    email: str,
    username: str | None,
    phone: str | None,
    password: str,
    is_active: bool,
    must_change_password: bool,
) -> User:
    user = User(
        full_name=full_name,
        email=email,
        username=username,
        phone=phone,
        password_hash=hash_password(password),
        role=UserRole.super_admin,
        restaurant_id=None,
        is_active=is_active,
        must_change_password=must_change_password,
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


# Tenant-safe staff write operations


def create_staff(
    db: Session,
    restaurant_id: int,
    data: StaffCreateRequest,
    *,
    must_change_password: bool = False,
) -> User:
    """Create a staff user scoped to a restaurant."""
    user = User(
        full_name=data.full_name,
        email=data.email,
        username=data.username,
        phone=data.phone,
        password_hash=hash_password(data.password),
        role=data.role,
        assigned_area=data.assigned_area,
        restaurant_id=restaurant_id,
        is_active=data.is_active,
        must_change_password=must_change_password,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_by_id(
    db: Session,
    user_id: int,
    restaurant_id: int,
    data: StaffUpdateRequest,
) -> User | None:
    """Update a staff member scoped to a restaurant."""
    user = get_by_id(db, user_id, restaurant_id)
    if not user:
        return None

    update_data = data.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["password_hash"] = hash_password(update_data.pop("password"))

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


def update_platform_user(
    db: Session,
    user: User,
    update_data: dict,
) -> User:
    if "password" in update_data:
        update_data["password_hash"] = hash_password(update_data.pop("password"))

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


def disable_by_id(db: Session, user_id: int, restaurant_id: int) -> User | None:
    """Set is_active=False for a staff member in the given restaurant."""
    user = get_by_id(db, user_id, restaurant_id)
    if not user:
        return None
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


def enable_by_id(db: Session, user_id: int, restaurant_id: int) -> User | None:
    """Set is_active=True for a staff member in the given restaurant."""
    user = get_by_id(db, user_id, restaurant_id)
    if not user:
        return None
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user


def delete_by_id(db: Session, user_id: int, restaurant_id: int) -> bool:
    """Hard-delete a staff member from the given restaurant."""
    user = get_by_id(db, user_id, restaurant_id)
    if not user:
        return False
    db.delete(user)
    db.commit()
    return True


def count_active_owners(db: Session, restaurant_id: int) -> int:
    """Count active users with the owner role for a restaurant."""
    return (
        db.query(User)
        .filter(
            User.restaurant_id == restaurant_id,
            User.role == UserRole.owner,
            User.is_active,
        )
        .count()
    )


def count_active_platform_users(db: Session) -> int:
    return (
        db.query(User)
        .filter(
            User.role == UserRole.super_admin,
            User.restaurant_id.is_(None),
            User.is_active.is_(True),
        )
        .count()
    )


def enable_platform_user(db: Session, user: User) -> User:
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user


def disable_platform_user(db: Session, user: User) -> User:
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


def delete_platform_user(db: Session, user: User) -> None:
    db.delete(user)
    db.commit()
