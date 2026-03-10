from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared SQLAlchemy declarative base.

    All ORM models must inherit from this class so Alembic and
    SQLAlchemy can discover them automatically.
    """
