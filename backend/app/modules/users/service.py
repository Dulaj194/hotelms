from sqlalchemy.orm import Session

from app.modules.users.model import User
from app.modules.users.repository import (
    create_user as repo_create_user,
    get_by_id_global,
)
from app.modules.users.schemas import UserCreate, UserResponse


def get_user(db: Session, user_id: int) -> User | None:
    # Global lookup — used for super_admin or internal references
    return get_by_id_global(db, user_id)


def create_user(db: Session, data: UserCreate) -> UserResponse:
    user = repo_create_user(db, data)
    return UserResponse.model_validate(user)
