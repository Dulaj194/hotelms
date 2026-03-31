"""
Database Configuration
SQLAlchemy engine and session factory
"""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from app.core.settings import settings
import logging

logger = logging.getLogger(__name__)

# Create SQLAlchemy engine
engine = create_engine(
    settings.database_url,
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,  # Verify connections before using
    echo=settings.db_echo,
    connect_args={"charset": "utf8mb4"}
)

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False
)

# Set MySQL timezone
@event.listens_for(engine, "connect")
def set_mysql_timezone(dbapi_conn, connection_record):
    """Set MySQL session timezone"""
    cursor = dbapi_conn.cursor()
    cursor.execute(f"SET time_zone = '{settings.default_timezone}'")
    cursor.close()


def get_db() -> Session:
    """
    Dependency: Get database session
    Use in FastAPI dependency injection

    Example:
        @app.get("/items")
        def get_items(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
