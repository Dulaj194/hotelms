from sqlalchemy import create_engine, pool
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Connection pooling configuration for production reliability (MySQL/Postgres)
is_sqlite = settings.database_url.startswith("sqlite")

pool_config = {}
if not is_sqlite:
    pool_config = {
        "pool_size": 50,  # Number of connections to keep in the pool (increased for prod)
        "max_overflow": 100,  # Additional connections created when pool is exhausted
        "pool_pre_ping": True,  # Test connection before using from pool
        "pool_recycle": 3600,  # Recycle connections every hour (MySQL timeout is usually 8h)
        "pool_timeout": 30,  # Wait up to 30s for connection from pool
        "connect_args": {
            "connect_timeout": 10,  # Initial connection timeout: 10 seconds
            "charset": "utf8mb4",
        },
    }
else:
    # SQLite-specific config (no pooling arguments allowed)
    pool_config = {
        "connect_args": {"check_same_thread": False},
    }

# Common config
pool_config["echo"] = settings.app_env == "development"

engine = create_engine(settings.database_url, **pool_config)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

if not is_sqlite:
    logger.info(
        "Database pool configured: size=%d, max_overflow=%d, recycle=%ds",
        pool_config.get("pool_size", 0),
        pool_config.get("max_overflow", 0),
        pool_config.get("pool_recycle", 0),
    )
else:
    logger.info("Database configured for SQLite (no pool).")
