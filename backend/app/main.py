from contextlib import asynccontextmanager
from pathlib import Path
import asyncio
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import router
from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.workers.subscription_expiry import run_subscription_expiry_loop

configure_logging()
logger = get_logger(__name__)

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

    if settings.app_env == "development":
        import time
        import app.db.init_models  # noqa: F401 — registers all models with Base
        from app.db.base import Base
        from app.db.schema_sync import ensure_development_schema_compatibility
        from app.db.session import engine
        from sqlalchemy import text

        # Retry connecting to MySQL — healthcheck passes before MySQL fully accepts connections
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
        logger.info("Database tables created / verified")

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files (logos, etc.) at /uploads
# In production replace with CDN/S3 pre-signed URL flow.
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

app.include_router(router)


@app.get("/", tags=["root"])
def root() -> dict:
    return {"message": f"Welcome to {settings.app_name} API"}
