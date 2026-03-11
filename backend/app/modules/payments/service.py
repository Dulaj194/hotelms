"""Payments service — lightweight for now, ready for gateway integration."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.modules.payments import repository as payment_repo
from app.modules.payments.schemas import PaymentResponse


def get_payment_for_order(
    db: Session, order_id: int, restaurant_id: int
) -> PaymentResponse | None:
    payment = payment_repo.get_payment_by_order(db, order_id, restaurant_id)
    if payment is None:
        return None
    return PaymentResponse.model_validate(payment)
