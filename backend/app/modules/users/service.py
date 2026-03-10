from sqlalchemy.orm import Session

from app.modules.users.model import User
from app.modules.users.repository import (
    create_user as repo_create_user,
    get_user_by_id,
)
from app.modules.users.schemas import UserCreate, UserResponse


def get_user(db: Session, user_id: int) -> User | None:
    return get_user_by_id(db, user_id)


def create_user(db: Session, data: UserCreate) -> UserResponse:
    user = repo_create_user(db, data)
    return UserResponse.model_validate(user)
