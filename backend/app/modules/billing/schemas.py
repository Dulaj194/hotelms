"""Pydantic schemas for the billing module."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.modules.billing.model import (
    BillContextType,
    BillHandoffStatus,
    BillPaymentAllocationStatus,
    BillReviewStatus,
    BillStatus,
)
from app.modules.payments.schemas import PaymentResponse


class BillOrderItemResponse(BaseModel):
    id: int
    item_name_snapshot: str
    quantity: int
    unit_price_snapshot: float
    line_total: float

    model_config = {"from_attributes": True}


class BillOrderResponse(BaseModel):
    id: int
    order_number: str
    placed_at: datetime
    total_amount: float
    items: list[BillOrderItemResponse]

    model_config = {"from_attributes": True}


class BillRecordResponse(BaseModel):
    id: int
    bill_number: str
    context_type: BillContextType
    session_id: str
    table_number: str | None
    room_id: int | None
    room_number: str | None
    subtotal_amount: float
    tax_amount: float
    discount_amount: float
    total_amount: float
    payment_method: str | None
    payment_status: BillStatus
    transaction_reference: str | None
    notes: str | None
    reversed_at: datetime | None = None
    reversal_reason: str | None = None
    handoff_status: BillHandoffStatus
    sent_to_cashier_at: datetime | None
    sent_to_accountant_at: datetime | None
    handoff_completed_at: datetime | None
    settled_at: datetime | None
    created_at: datetime
    cashier_status: BillReviewStatus | None = None
    accountant_status: BillReviewStatus | None = None
    printed_count: int = 0
    last_printed_at: datetime | None = None
    reopened_count: int = 0

    model_config = {"from_attributes": True}


class BillSummaryResponse(BaseModel):
    context_type: BillContextType
    session_id: str
    restaurant_id: int
    table_number: str | None
    room_id: int | None
    room_number: str | None
    orders: list[BillOrderResponse]
    order_count: int
    subtotal: float
    tax_amount: float
    discount_amount: float
    grand_total: float
    session_is_active: bool
    is_settled: bool
    bill: BillRecordResponse | None = None


class SettleSessionRequest(BaseModel):
    payment_method: Literal["cash", "card", "manual"] | None = None
    transaction_reference: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=1000)
    paid_amount: float | None = Field(default=None, gt=0)
    tax_rule_mode: Literal["none", "percentage", "fixed"] = "none"
    tax_rule_value: float = Field(default=0, ge=0)
    discount_rule_mode: Literal["none", "percentage", "fixed"] = "none"
    discount_rule_value: float = Field(default=0, ge=0)

    @model_validator(mode="after")
    def validate_adjustment_rules(self) -> "SettleSessionRequest":
        if self.tax_rule_mode == "none" and self.tax_rule_value != 0:
            raise ValueError("tax_rule_value must be 0 when tax_rule_mode is 'none'.")
        if self.discount_rule_mode == "none" and self.discount_rule_value != 0:
            raise ValueError("discount_rule_value must be 0 when discount_rule_mode is 'none'.")
        if self.tax_rule_mode != "none" and self.tax_rule_value <= 0:
            raise ValueError("tax_rule_value must be greater than 0 when a tax rule is enabled.")
        if self.discount_rule_mode != "none" and self.discount_rule_value <= 0:
            raise ValueError("discount_rule_value must be greater than 0 when a discount rule is enabled.")
        if self.payment_method is None:
            raise ValueError("payment_method is required.")
        return self


class SettlementSplitPaymentRequest(BaseModel):
    payment_method: Literal["cash", "card", "manual"]
    amount: float = Field(..., gt=0)
    transaction_reference: str | None = Field(default=None, max_length=255)
    gateway_provider: Literal["stripe"] | None = None
    gateway_payment_intent_id: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def validate_gateway_fields(self) -> "SettlementSplitPaymentRequest":
        if self.gateway_provider is None and self.gateway_payment_intent_id is not None:
            raise ValueError("gateway_provider is required when gateway_payment_intent_id is provided.")
        if self.gateway_provider is not None and self.payment_method != "card":
            raise ValueError("gateway-backed split payments are only supported for card method.")
        if self.gateway_provider == "stripe" and not self.gateway_payment_intent_id:
            raise ValueError("gateway_payment_intent_id is required for stripe gateway settlements.")
        return self


class SettleSessionSplitRequest(SettleSessionRequest):
    payments: list[SettlementSplitPaymentRequest] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_splits(self) -> "SettleSessionSplitRequest":
        if not self.payments:
            return self
        total = round(sum(float(payment.amount) for payment in self.payments), 2)
        if self.paid_amount is not None and round(float(self.paid_amount), 2) != total:
            raise ValueError("paid_amount must equal the sum of split payment amounts.")
        return self


class BillPaymentAllocationResponse(BaseModel):
    id: int
    payment_method: str
    amount: float
    transaction_reference: str | None
    gateway_provider: str | None
    gateway_payment_intent_id: str | None
    allocation_status: BillPaymentAllocationStatus
    notes: str | None
    created_at: datetime


class SettleSessionResponse(BaseModel):
    bill_id: int
    bill_number: str
    context_type: BillContextType
    session_id: str
    table_number: str | None
    room_id: int | None
    room_number: str | None
    order_count: int
    total_amount: float
    paid_amount: float
    remaining_amount: float
    payment_method: str
    payment_status: BillStatus
    handoff_status: BillHandoffStatus
    settled_at: datetime
    is_partial: bool
    idempotent_replay: bool = False
    allocations: list[BillPaymentAllocationResponse] = Field(default_factory=list)
    session_closed: bool


class SessionBillingStatusResponse(BaseModel):
    context_type: BillContextType
    session_id: str
    table_number: str | None
    room_id: int | None
    room_number: str | None
    is_active: bool
    is_settled: bool
    billable_order_count: int
    grand_total: float
    handoff_status: BillHandoffStatus | None = None


class SessionPaymentHistoryResponse(BaseModel):
    context_type: BillContextType
    session_id: str
    table_number: str | None
    room_id: int | None
    room_number: str | None
    payments: list[PaymentResponse]
    total: int


class BillListResponse(BaseModel):
    items: list[BillRecordResponse]
    total: int


class BillingActorResponse(BaseModel):
    user_id: int | None = None
    full_name: str | None = None
    role: str | None = None


class BillWorkflowEventResponse(BaseModel):
    id: int
    bill_id: int
    bill_number: str
    context_type: BillContextType
    session_id: str
    table_number: str | None
    room_number: str | None
    action_type: str
    note: str | None = None
    metadata: dict[str, Any] | None = None
    created_at: datetime
    actor: BillingActorResponse = Field(default_factory=BillingActorResponse)


class BillWorkflowEventListResponse(BaseModel):
    items: list[BillWorkflowEventResponse]
    total: int


class BillDetailResponse(BillSummaryResponse):
    payments: list[PaymentResponse]
    payment_count: int
    allocations: list[BillPaymentAllocationResponse] = Field(default_factory=list)
    events: list[BillWorkflowEventResponse]


class BillWorkflowActionRequest(BaseModel):
    note: str | None = Field(default=None, max_length=1000)


class ReverseBillRequest(BaseModel):
    mode: Literal["refund", "void", "reversal"]
    reason: str = Field(..., min_length=3, max_length=1000)
    reopen_session: bool = True


class BillingQueueSummaryResponse(BaseModel):
    fresh_count: int
    cashier_pending_count: int
    cashier_accepted_count: int
    accountant_pending_count: int
    completed_count: int
    printed_today_count: int
    rejected_today_count: int
    reopened_today_count: int
    room_folio_total: int


class BillingReconciliationPaymentMethodResponse(BaseModel):
    payment_method: str
    folio_count: int
    total_amount: float


class BillingReconciliationResponse(BaseModel):
    business_date: date
    total_paid_bills: int
    total_paid_amount: float
    room_paid_amount: float
    table_paid_amount: float
    completed_room_folios: int
    outstanding_cashier_folios: int
    outstanding_accountant_folios: int
    printed_today_count: int
    reopened_today_count: int
    payment_methods: list[BillingReconciliationPaymentMethodResponse]
    recent_completed: list[BillRecordResponse]
