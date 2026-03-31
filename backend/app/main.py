from contextlib import asynccontextmanager
from pathlib import Path
import asyncio
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from app.api.router import router
from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.workers.subscription_expiry import run_subscription_expiry_loop

configure_logging()
logger = get_logger(__name__)


def _get_allowed_cors_origins() -> list[str]:
    """Build allowed origins list from FRONTEND_URL and local dev defaults."""
    origins = {
        origin.strip().rstrip("/")
        for origin in settings.frontend_url.split(",")
        if origin.strip()
    }
    if settings.app_env == "development":
        origins.update({"http://localhost:5173", "http://127.0.0.1:5173"})
    return sorted(origins)

# Ensure upload directory exists at startup (required before StaticFiles mount)
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
(Path(settings.upload_dir) / "logos").mkdir(parents=True, exist_ok=True)
(Path(settings.upload_dir) / "qrcodes").mkdir(parents=True, exist_ok=True)
(Path(settings.upload_dir) / "videos").mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Starting %s [env=%s]", settings.app_name, settings.app_env)

    # Ensure upload directories exist
    upload_root = Path(settings.upload_dir)
    (upload_root / "logos").mkdir(parents=True, exist_ok=True)
    (upload_root / "qrcodes").mkdir(parents=True, exist_ok=True)
    (upload_root / "videos").mkdir(parents=True, exist_ok=True)
    logger.info("Upload directories ready at %s", upload_root.resolve())

    if settings.app_env == "development" and settings.db_auto_schema_sync:
        import time
        import app.db.init_models  # noqa: F401 - registers all models with Base
        from app.db.base import Base
        from app.db.schema_sync import ensure_development_schema_compatibility
        from app.db.session import engine
        from sqlalchemy import text

        logger.warning(
            "DB auto schema sync is enabled. Prefer Alembic migrations for predictable schema changes."
        )

        # Retry connecting to MySQL - healthcheck passes before MySQL fully accepts connections
        for attempt in range(1, 11):
            try:
                with engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                break
            except Exception as exc:
                logger.warning("DB not ready (attempt %d/10): %s", attempt, exc)
                time.sleep(3)
        else:
            raise RuntimeError("Could not connect to database after 10 attempts")

        Base.metadata.create_all(bind=engine)
        ensure_development_schema_compatibility(engine, logger)
        logger.info("Database tables created / verified (legacy fallback mode)")
    elif settings.app_env == "development":
        logger.info(
            "DB auto schema sync is disabled. Running compatibility checks for legacy development schemas."
        )
        try:
            from app.db.schema_sync import ensure_development_schema_compatibility
            from app.db.session import engine

            ensure_development_schema_compatibility(engine, logger)
            logger.info("Development schema compatibility checks completed.")
        except Exception as exc:
            logger.warning("Development schema compatibility checks skipped: %s", exc)

    # Start background worker: mark overdue subscriptions as expired hourly.
    expiry_task = asyncio.create_task(run_subscription_expiry_loop())

    yield

    expiry_task.cancel()
    try:
        await expiry_task
    except asyncio.CancelledError:
        pass
    logger.info("Shutting down %s", settings.app_name)


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

allowed_origins = _get_allowed_cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info("CORS allow_origins=%s", allowed_origins)


@app.exception_handler(OperationalError)
async def handle_operational_error(_request: Request, exc: OperationalError) -> JSONResponse:
    logger.exception("Database operational error: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "detail": (
                "Database operation failed. Verify DATABASE_URL/MySQL availability and apply schema migrations."
            )
        },
    )


@app.exception_handler(SQLAlchemyError)
async def handle_sqlalchemy_error(_request: Request, exc: SQLAlchemyError) -> JSONResponse:
    logger.exception("Database error: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Database query failed. Verify migrations and schema state."},
    )

# Serve uploaded files (logos, etc.) at /uploads
# In production replace with CDN/S3 pre-signed URL flow.
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

app.include_router(router)


@app.get("/", tags=["root"])
def root() -> dict:
    return {"message": f"Welcome to {settings.app_name} API"}
