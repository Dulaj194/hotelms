from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator, model_validator


class PromoCodeCreateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    discount_percent: float = Field(..., gt=0, le=100)
    valid_from: date
    valid_until: date
    usage_limit: int | None = Field(default=None, ge=1)
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("Code must not be empty.")
        return normalized

    @model_validator(mode="after")
    def validate_date_range(self) -> "PromoCodeCreateRequest":
        if self.valid_until < self.valid_from:
            raise ValueError("valid_until cannot be before valid_from.")
        return self


class PromoCodeUpdateRequest(BaseModel):
    discount_percent: float | None = Field(default=None, gt=0, le=100)
    valid_from: date | None = None
    valid_until: date | None = None
    usage_limit: int | None = Field(default=None, ge=1)
    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_date_range(self) -> "PromoCodeUpdateRequest":
        if self.valid_from and self.valid_until and self.valid_until < self.valid_from:
            raise ValueError("valid_until cannot be before valid_from.")
        return self


class PromoCodeValidateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("Code must not be empty.")
        return normalized


class PromoCodeConsumeRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    increment: int = Field(default=1, ge=1, le=100)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("Code must not be empty.")
        return normalized


class PromoCodeResponse(BaseModel):
    id: int
    code: str
    discount_percent: float
    valid_from: date
    valid_until: date
    usage_limit: int | None
    used_count: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PromoCodeListResponse(BaseModel):
    items: list[PromoCodeResponse]
    total: int


class PromoCodeValidationResponse(BaseModel):
    valid: bool
    message: str
    code: str | None = None
    discount_percent: float | None = None
    usage_limit: int | None = None
    global_used_count: int = 0
    restaurant_used_count: int = 0


class PromoCodeUsageResponse(BaseModel):
    code: str
    restaurant_id: int
    used_count: int
    global_used_count: int
    last_used_at: datetime | None
    message: str
