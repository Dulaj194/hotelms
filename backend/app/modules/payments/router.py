"""Payments router for Stripe checkout and billing history endpoints."""
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.dependencies import (
	get_current_restaurant_id,
	get_db,
	require_platform_scopes,
	require_roles,
)
from app.modules.access import role_catalog
from app.modules.payments import service
from app.modules.payments.schemas import (
	BillingTransactionListResponse,
	BillingTransactionResponse,
	CheckoutSessionRequest,
	CheckoutSessionResponse,
	PlatformCommercialOverviewResponse,
	WebhookAckResponse,
)

router = APIRouter()

_RESTAURANT_ADMIN_ROLES = role_catalog.RESTAURANT_ADMIN_ROLES


@router.post("/checkout", response_model=CheckoutSessionResponse)
def create_checkout_session(
	payload: CheckoutSessionRequest,
	restaurant_id: int = Depends(get_current_restaurant_id),
	db: Session = Depends(get_db),
	_=Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
) -> CheckoutSessionResponse:
	return service.create_checkout_session(
		db,
		restaurant_id=restaurant_id,
		package_id=payload.package_id,
		promo_code=payload.promo_code,
	)


@router.post("/webhook", response_model=WebhookAckResponse)
async def handle_stripe_webhook(
	request: Request,
	db: Session = Depends(get_db),
) -> WebhookAckResponse:
	signature = request.headers.get("stripe-signature")
	if not signature:
		return WebhookAckResponse(received=False)

	payload = await request.body()
	service.process_webhook(db, payload_bytes=payload, stripe_signature=signature)
	return WebhookAckResponse(received=True)


@router.get("/history", response_model=BillingTransactionListResponse)
def get_billing_history(
	restaurant_id: int = Depends(get_current_restaurant_id),
	db: Session = Depends(get_db),
	_=Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
	limit: int = Query(default=20, ge=1, le=100),
	offset: int = Query(default=0, ge=0),
) -> BillingTransactionListResponse:
	return service.get_billing_history(db, restaurant_id=restaurant_id, limit=limit, offset=offset)


@router.get("/history/{transaction_id}", response_model=BillingTransactionResponse)
def get_billing_transaction_detail(
	transaction_id: int,
	restaurant_id: int = Depends(get_current_restaurant_id),
	db: Session = Depends(get_db),
	_=Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
) -> BillingTransactionResponse:
	return service.get_billing_transaction_detail(
		db,
		restaurant_id=restaurant_id,
		transaction_id=transaction_id,
	)


@router.get("/admin/oversight", response_model=PlatformCommercialOverviewResponse)
def get_platform_commercial_overview(
	db: Session = Depends(get_db),
	_=Depends(require_platform_scopes("ops_viewer", "billing_admin")),
) -> PlatformCommercialOverviewResponse:
	return service.get_platform_commercial_overview(db)
