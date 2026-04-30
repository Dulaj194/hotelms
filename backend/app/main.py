import asyncio
import time
import traceback
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator, Callable

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response

from app.api.router import router
from app.core.config import settings
from app.core.exceptions import HotelMSException
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
(Path(settings.upload_dir) / "categories").mkdir(parents=True, exist_ok=True)
(Path(settings.upload_dir) / "logos").mkdir(parents=True, exist_ok=True)
(Path(settings.upload_dir) / "items").mkdir(parents=True, exist_ok=True)
(Path(settings.upload_dir) / "menus").mkdir(parents=True, exist_ok=True)
(Path(settings.upload_dir) / "offers").mkdir(parents=True, exist_ok=True)
(Path(settings.upload_dir) / "qrcodes").mkdir(parents=True, exist_ok=True)
(Path(settings.upload_dir) / "videos").mkdir(parents=True, exist_ok=True)



@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Starting %s [env=%s]", settings.app_name, settings.app_env)

    # Ensure upload directories exist
    upload_root = Path(settings.upload_dir)
    (upload_root / "categories").mkdir(parents=True, exist_ok=True)
    (upload_root / "logos").mkdir(parents=True, exist_ok=True)
    (upload_root / "items").mkdir(parents=True, exist_ok=True)
    (upload_root / "menus").mkdir(parents=True, exist_ok=True)
    (upload_root / "offers").mkdir(parents=True, exist_ok=True)
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
# Middleware order matters - add timing first, then error handling
# Request flows through: Timing → Error Handler → CORS → App Logic


@app.middleware("http")
async def request_timing_middleware(request: Request, call_next: Callable) -> Response:
    """Log request processing time to identify slow endpoints."""
    start_time = time.time()
    request_size = request.headers.get("content-length", "0")
    
    try:
        response = await call_next(request)
        duration = time.time() - start_time
        
        # Log slow requests (>1 second)
        if duration > 1.0:
            logger.warning(
                "Slow request [%.2fs] - %s %s (size: %s)",
                duration,
                request.method,
                request.url.path,
                request_size,
            )
        
        # Add response timing header
        response.headers["X-Process-Time"] = str(duration)
        return response
    except Exception as exc:
        duration = time.time() - start_time
        logger.error(
            "Request failed [%.2fs] - %s %s - %s",
            duration,
            request.method,
            request.url.path,
            str(exc),
        )
        raise


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_origin_regex=settings.cors_allowed_origin_regex,
    allow_credentials=True,  # Only safe because allow_origins is explicitly curated
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],  # Explicit methods
    allow_headers=["Content-Type", "Authorization", "Accept"],  # Explicit headers
    max_age=3600,  # Cache CORS preflight for 1 hour
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


@app.middleware("http")
async def dependency_failure_middleware(request: Request, call_next: Callable) -> Response:
    """
    Catch dependency injection failures (e.g., Redis timeout, DB connection error)
    and return proper error responses instead of 502.
    """
    try:
        response = await call_next(request)
        return response
    except HTTPException as exc:
        # Re-raise HTTPException - will be handled by exception handler below
        raise
    except Exception as exc:
        error_id = id(exc)
        # Log the dependency failure
        logger.error(
            "Dependency failure [%s] - %s %s - %s: %s",
            error_id,
            request.method,
            request.url.path,
            exc.__class__.__name__,
            str(exc),
            exc_info=exc,
        )
        
        # Return appropriate error based on exception type
        if "redis" in str(exc).lower():
            status_code = 503  # Service Unavailable
            detail = "Redis service temporarily unavailable. Please try again."
        elif "database" in str(exc).lower() or "connection" in str(exc).lower():
            status_code = 503
            detail = "Database service temporarily unavailable. Please try again."
        else:
            status_code = 502  # Bad Gateway
            detail = "Backend service error. Please try again."
        
        return JSONResponse(
            status_code=status_code,
            content={"detail": detail, "error_id": error_id},
        )


# Serve uploaded files (logos, etc.) at /uploads
# In production replace with CDN/S3 pre-signed URL flow.
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Log all unhandled exceptions as Internal Server Errors (500)."""
    error_id = id(exc)  # Simple error ID for tracking
    logger.error(
        "Internal Server Error [%s] - %s %s - %s: %s",
        error_id,
        request.method,
        request.url.path,
        exc.__class__.__name__,
        str(exc),
        exc_info=exc,
    )
    # Log full traceback for debugging
    logger.debug("Traceback for error [%s]:\n%s", error_id, traceback.format_exc())
    
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error_id": error_id},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Log HTTP exceptions including Bad Gateway (502) errors."""
    error_id = id(exc)
    
    # Log Bad Gateway (502) with higher severity
    if exc.status_code == 502:
        logger.error(
            "Bad Gateway [%s] - %s %s - Upstream service unreachable",
            error_id,
            request.method,
            request.url.path,
            exc_info=exc,
        )
    elif exc.status_code >= 500:
        logger.error(
            "HTTP %d [%s] - %s %s - %s",
            exc.status_code,
            error_id,
            request.method,
            request.url.path,
            exc.detail,
        )
    else:
        logger.warning(
            "HTTP %d - %s %s - %s",
            exc.status_code,
            request.method,
            request.url.path,
            exc.detail,
        )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "error_id": error_id},
    )


@app.exception_handler(HotelMSException)
async def hotelms_exception_handler(request: Request, exc: HotelMSException):
    """Convert domain exceptions to HTTP responses."""
    error_id = id(exc)
    
    # Log based on status code severity
    if exc.status_code >= 500:
        logger.error(
            "Domain Error %s [%s] - %s %s - %s",
            exc.error_code,
            error_id,
            request.method,
            request.url.path,
            exc.detail,
            exc_info=exc,
        )
    elif exc.status_code >= 400:
        logger.warning(
            "Domain Error %s - %s %s - %s",
            exc.error_code,
            request.method,
            request.url.path,
            exc.detail,
        )
    
    response_data = {
        "detail": exc.detail,
        "error_code": exc.error_code,
        "error_id": error_id,
    }
    
    # Include extra context if provided
    if exc.extra:
        response_data["extra"] = exc.extra
    
    return JSONResponse(
        status_code=exc.status_code,
        content=response_data,
    )


# Serve uploaded files (logos, etc.) at /uploads
# In production replace with CDN/S3 pre-signed URL flow.
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

app.include_router(router)


@app.get("/", tags=["root"])
def root() -> dict:
    return {"message": f"Welcome to {settings.app_name} API"}
