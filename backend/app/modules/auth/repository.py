from datetime import datetime

from sqlalchemy.orm import Session

from app.modules.auth.model import PasswordResetToken


def create_reset_token(
    db: Session,
    user_id: int,
    token_hash: str,
    expires_at: datetime,
) -> PasswordResetToken:
    record = PasswordResetToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_reset_token_by_hash(db: Session, token_hash: str) -> PasswordResetToken | None:
    return (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash)
        .first()
    )


def mark_token_used(db: Session, token: PasswordResetToken) -> None:
    from datetime import UTC, datetime

    token.used_at = datetime.now(UTC)
    db.commit()
