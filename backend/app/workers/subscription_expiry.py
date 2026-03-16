"""Background worker: periodically marks overdue subscriptions as expired.

Runs as an asyncio task inside the FastAPI lifespan.  The first execution
happens *after* the first sleep interval (not at startup) so the DB has time
to fully initialize before any writes occur.
"""

import asyncio
import logging

logger = logging.getLogger(__name__)

_DEFAULT_INTERVAL_SECONDS = 3600  # 1 hour


async def run_subscription_expiry_loop(
    interval_seconds: int = _DEFAULT_INTERVAL_SECONDS,
) -> None:
    """Async infinite loop that expires overdue subscriptions.

    Imported lazily inside the loop body so the worker module can be
    imported at process start before the DB engine is ready.
    """
    logger.info(
        "Subscription expiry worker started (interval=%ds).", interval_seconds
    )
    while True:
        try:
            await asyncio.sleep(interval_seconds)
        except asyncio.CancelledError:
            logger.info("Subscription expiry worker cancelled.")
            raise

        try:
            # Lazy import — avoids circular-import issues at module load time.
            from app.db.session import SessionLocal
            from app.modules.subscriptions.service import expire_overdue_subscriptions

            db = SessionLocal()
            try:
                count = expire_overdue_subscriptions(db)
                if count > 0:
                    logger.info(
                        "Subscription expiry worker: marked %d subscription(s) as expired.",
                        count,
                    )
            finally:
                db.close()
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            logger.exception("Subscription expiry worker encountered an error.")
