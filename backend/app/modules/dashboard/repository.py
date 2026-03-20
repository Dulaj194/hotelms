from __future__ import annotations

import json
from datetime import UTC, date, datetime

from sqlalchemy.orm import Session

from app.modules.dashboard.model import DashboardAlertImpression, DashboardSetupProgress


def get_alert_impression_for_day(
    db: Session,
    *,
    restaurant_id: int,
    alert_key: str,
    shown_date: date,
) -> DashboardAlertImpression | None:
    return (
        db.query(DashboardAlertImpression)
        .filter(
            DashboardAlertImpression.restaurant_id == restaurant_id,
            DashboardAlertImpression.alert_key == alert_key,
            DashboardAlertImpression.shown_date == shown_date,
        )
        .first()
    )


def upsert_alert_impression(
    db: Session,
    *,
    restaurant_id: int,
    alert_key: str,
    alert_level: str,
    shown_date: date,
) -> DashboardAlertImpression:
    item = get_alert_impression_for_day(
        db,
        restaurant_id=restaurant_id,
        alert_key=alert_key,
        shown_date=shown_date,
    )

    now = datetime.now(UTC)
    if item is None:
        item = DashboardAlertImpression(
            restaurant_id=restaurant_id,
            alert_key=alert_key,
            alert_level=alert_level,
            shown_date=shown_date,
            last_shown_at=now,
        )
        db.add(item)
    else:
        item.alert_level = alert_level
        item.last_shown_at = now

    db.commit()
    db.refresh(item)
    return item


def dismiss_alert(
    db: Session,
    *,
    restaurant_id: int,
    alert_key: str,
    dismissed_until: datetime,
) -> DashboardAlertImpression:
    shown_date = datetime.now(UTC).date()
    item = get_alert_impression_for_day(
        db,
        restaurant_id=restaurant_id,
        alert_key=alert_key,
        shown_date=shown_date,
    )

    if item is None:
        item = DashboardAlertImpression(
            restaurant_id=restaurant_id,
            alert_key=alert_key,
            alert_level="info",
            shown_date=shown_date,
            dismissed_until=dismissed_until,
        )
        db.add(item)
    else:
        item.dismissed_until = dismissed_until

    db.commit()
    db.refresh(item)
    return item


def get_setup_progress(db: Session, *, restaurant_id: int) -> DashboardSetupProgress | None:
    return (
        db.query(DashboardSetupProgress)
        .filter(DashboardSetupProgress.restaurant_id == restaurant_id)
        .first()
    )


def get_completed_keys(progress: DashboardSetupProgress | None) -> list[str]:
    if progress is None:
        return []
    try:
        payload = json.loads(progress.completed_keys_json)
        if isinstance(payload, list):
            return [str(item) for item in payload]
        return []
    except Exception:
        return []


def upsert_setup_progress(
    db: Session,
    *,
    restaurant_id: int,
    current_step: int,
    completed_keys: list[str],
) -> DashboardSetupProgress:
    progress = get_setup_progress(db, restaurant_id=restaurant_id)
    encoded = json.dumps(sorted(set(completed_keys)))

    if progress is None:
        progress = DashboardSetupProgress(
            restaurant_id=restaurant_id,
            current_step=current_step,
            completed_keys_json=encoded,
        )
        db.add(progress)
    else:
        progress.current_step = current_step
        progress.completed_keys_json = encoded

    db.commit()
    db.refresh(progress)
    return progress
