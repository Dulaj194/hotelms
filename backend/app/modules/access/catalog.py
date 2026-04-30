from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AccessModuleDefinition:
    key: str
    label: str
    description: str
    package_privileges: tuple[str, ...] = ()
    feature_flags: tuple[str, ...] = ()
    feature_flag_match: str = "all"


@dataclass(frozen=True)
class RestaurantFeatureFlagDefinition:
    code: str
    key: str
    label: str
    description: str
    column_name: str
    modules: tuple[str, ...]


_MODULE_DEFINITIONS = {
    "orders": AccessModuleDefinition(
        key="orders",
        label="Orders",
        description="Guest ordering workflows and order-management tools.",
        package_privileges=("QR_MENU",),
    ),
    "qr": AccessModuleDefinition(
        key="qr",
        label="QR Codes",
        description="Table and room QR generation and management.",
        package_privileges=("QR_MENU",),
    ),
    "kds": AccessModuleDefinition(
        key="kds",
        label="KDS",
        description="Kitchen display and steward order-processing boards.",
        package_privileges=("QR_MENU",),
        feature_flags=("KDS",),
    ),
    "steward_ops": AccessModuleDefinition(
        key="steward_ops",
        label="Steward Workflow",
        description="Steward-facing order handoff, readiness, and serving workflows.",
        package_privileges=("QR_MENU",),
        feature_flags=("KDS", "STEWARD"),
    ),
    "reports": AccessModuleDefinition(
        key="reports",
        label="Reports",
        description="Operational and sales reporting dashboards.",
        package_privileges=("QR_MENU",),
        feature_flags=("REPORTS",),
    ),
    "billing": AccessModuleDefinition(
        key="billing",
        label="Billing",
        description="Invoice capture, payment handling, and settlement workflows.",
        package_privileges=("QR_MENU",),
        feature_flags=("CASHIER", "ACCOUNTANT"),
        feature_flag_match="any",
    ),
    "housekeeping": AccessModuleDefinition(
        key="housekeeping",
        label="Housekeeping",
        description="Room-service tasks, requests, and housekeeping boards.",
        package_privileges=("HOUSEKEEPING",),
        feature_flags=("HOUSEKEEPING",),
    ),
    "offers": AccessModuleDefinition(
        key="offers",
        label="Offers",
        description="Promotional offers, discount campaigns, and marketing content.",
        package_privileges=("OFFERS",),
    ),
}

_FEATURE_FLAG_DEFINITIONS = {
    "steward": RestaurantFeatureFlagDefinition(
        code="STEWARD",
        key="steward",
        label="Steward",
        description="Allow steward-specific order handoff and serving workflows.",
        column_name="enable_steward",
        modules=("steward_ops",),
    ),
    "housekeeping": RestaurantFeatureFlagDefinition(
        code="HOUSEKEEPING",
        key="housekeeping",
        label="Housekeeping",
        description="Allow housekeeping task boards and room-service request workflows.",
        column_name="enable_housekeeping",
        modules=("housekeeping",),
    ),
    "kds": RestaurantFeatureFlagDefinition(
        code="KDS",
        key="kds",
        label="KDS",
        description="Allow kitchen display and steward order-processing workflows.",
        column_name="enable_kds",
        modules=("kds",),
    ),
    "reports": RestaurantFeatureFlagDefinition(
        code="REPORTS",
        key="reports",
        label="Reports",
        description="Allow report dashboards and sales exports.",
        column_name="enable_reports",
        modules=("reports",),
    ),
    "accountant": RestaurantFeatureFlagDefinition(
        code="ACCOUNTANT",
        key="accountant",
        label="Accountant",
        description="Allow accounting-oriented billing review access.",
        column_name="enable_accountant",
        modules=("billing",),
    ),
    "cashier": RestaurantFeatureFlagDefinition(
        code="CASHIER",
        key="cashier",
        label="Cashier",
        description="Allow cashier billing and payment-settlement access.",
        column_name="enable_cashier",
        modules=("billing",),
    ),
}

_FEATURE_FLAG_DEFINITIONS_BY_CODE = {
    definition.code: definition for definition in _FEATURE_FLAG_DEFINITIONS.values()
}


def list_module_definitions() -> list[AccessModuleDefinition]:
    return list(_MODULE_DEFINITIONS.values())


def get_module_definition(key: str) -> AccessModuleDefinition | None:
    return _MODULE_DEFINITIONS.get(key.strip().lower())


def list_feature_flag_definitions() -> list[RestaurantFeatureFlagDefinition]:
    return list(_FEATURE_FLAG_DEFINITIONS.values())


def get_feature_flag_definition(value: str) -> RestaurantFeatureFlagDefinition | None:
    normalized_key = value.strip().lower()
    if normalized_key in _FEATURE_FLAG_DEFINITIONS:
        return _FEATURE_FLAG_DEFINITIONS[normalized_key]

    return _FEATURE_FLAG_DEFINITIONS_BY_CODE.get(value.strip().upper())


def build_feature_flag_snapshot(restaurant) -> dict[str, bool]:
    return {
        definition.key: bool(getattr(restaurant, definition.column_name, True))
        for definition in list_feature_flag_definitions()
    }


def flatten_feature_flag_updates(feature_flags: dict[str, bool | None]) -> dict[str, bool]:
    flattened: dict[str, bool] = {}
    for key, value in feature_flags.items():
        definition = get_feature_flag_definition(key)
        if definition is None or value is None:
            continue
        flattened[definition.column_name] = bool(value)
    return flattened


def get_feature_flag_key(code: str) -> str:
    definition = get_feature_flag_definition(code)
    if definition is None:
        return code.strip().lower()
    return definition.key


def is_module_enabled_by_feature_flags(
    module: AccessModuleDefinition,
    feature_flags: dict[str, bool],
) -> bool:
    if not module.feature_flags:
        return True

    flag_values = [
        bool(feature_flags.get(get_feature_flag_key(code), False))
        for code in module.feature_flags
    ]
    if module.feature_flag_match == "any":
        return any(flag_values)
    return all(flag_values)
