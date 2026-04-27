from sqlalchemy import create_engine, pool
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Connection pooling configuration for production reliability
pool_config = {
    "pool_size": 20,  # Number of connections to keep in the pool
    "max_overflow": 40,  # Additional connections created when pool is exhausted
    "pool_pre_ping": True,  # Test connection before using from pool
    "pool_recycle": 3600,  # Recycle connections every hour (MySQL timeout is usually 8h)
    "pool_timeout": 30,  # Wait up to 30s for connection from pool
    "connect_args": {
        "connect_timeout": 10,  # Initial connection timeout: 10 seconds
        "charset": "utf8mb4",
    },
    "echo": settings.app_env == "development",
}

engine = create_engine(settings.database_url, **pool_config)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

logger.info(
    "Database pool configured: size=%d, max_overflow=%d, recycle=%ds",
    pool_config["pool_size"],
    pool_config["max_overflow"],
    pool_config["pool_recycle"],
)
