from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class PackageResponse(BaseModel):
    id: int
    name: str
    code: str
    description: str | None
    price: Decimal
    billing_period_days: int
    is_active: bool

    model_config = {"from_attributes": True}


class PackageDetailResponse(PackageResponse):
    privileges: list[str]
    created_at: datetime
    updated_at: datetime


class PackageListResponse(BaseModel):
    items: list[PackageResponse]


class PackagePrivilegeModuleItem(BaseModel):
    key: str
    label: str
    description: str


class PackagePrivilegeCatalogItem(BaseModel):
    code: str
    label: str
    description: str
    modules: list[PackagePrivilegeModuleItem] = Field(default_factory=list)


class PackagePrivilegeCatalogResponse(BaseModel):
    items: list[PackagePrivilegeCatalogItem]


class PackageCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=2, max_length=50)
    description: str | None = Field(default=None, max_length=500)
    price: Decimal = Field(..., ge=0)
    billing_period_days: int = Field(..., ge=1, le=3650)
    is_active: bool = True
    privileges: list[str] = Field(default_factory=list)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("privileges")
    @classmethod
    def normalize_privileges(cls, values: list[str]) -> list[str]:
        normalized = [value.strip().upper() for value in values if value.strip()]
        return list(dict.fromkeys(normalized))


class PackageUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, min_length=2, max_length=50)
    description: str | None = Field(default=None, max_length=500)
    price: Decimal | None = Field(default=None, ge=0)
    billing_period_days: int | None = Field(default=None, ge=1, le=3650)
    is_active: bool | None = None
    privileges: list[str] | None = None

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip().lower()

    @field_validator("privileges")
    @classmethod
    def normalize_privileges(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        normalized = [value.strip().upper() for value in values if value.strip()]
        return list(dict.fromkeys(normalized))


class PackageAdminListResponse(BaseModel):
    items: list[PackageDetailResponse]
    total: int


class PackageDeleteResponse(BaseModel):
    message: str
    package_id: int
