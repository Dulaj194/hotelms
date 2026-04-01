from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PackageAccessModuleDefinition:
    key: str
    label: str
    description: str


@dataclass(frozen=True)
class PackagePrivilegeDefinition:
    code: str
    label: str
    description: str
    modules: tuple[PackageAccessModuleDefinition, ...]


_ACCESS_MODULES = {
    "ORDERS": PackageAccessModuleDefinition(
        key="orders",
        label="Orders",
        description="Kitchen, steward, and service order operations.",
    ),
    "REPORTS": PackageAccessModuleDefinition(
        key="reports",
        label="Reports",
        description="Operational and sales reporting dashboards.",
    ),
    "BILLING": PackageAccessModuleDefinition(
        key="billing",
        label="Billing",
        description="Invoice capture and bill settlement workflows.",
    ),
    "HOUSEKEEPING": PackageAccessModuleDefinition(
        key="housekeeping",
        label="Housekeeping",
        description="Room service tasks, requests, and housekeeping boards.",
    ),
    "OFFERS": PackageAccessModuleDefinition(
        key="offers",
        label="Offers",
        description="Promotional offers, discount campaigns, and marketing content.",
    ),
}

_PRIVILEGE_DEFINITIONS = {
    "QR_MENU": PackagePrivilegeDefinition(
        code="QR_MENU",
        label="QR Menu",
        description="Enables table and room QR ordering operations.",
        modules=(
            _ACCESS_MODULES["ORDERS"],
            _ACCESS_MODULES["REPORTS"],
            _ACCESS_MODULES["BILLING"],
        ),
    ),
    "HOUSEKEEPING": PackagePrivilegeDefinition(
        code="HOUSEKEEPING",
        label="Housekeeping",
        description="Enables housekeeping workflows and room task management.",
        modules=(_ACCESS_MODULES["HOUSEKEEPING"],),
    ),
    "OFFERS": PackagePrivilegeDefinition(
        code="OFFERS",
        label="Offers",
        description="Enables promotional offers and discount campaign tools.",
        modules=(_ACCESS_MODULES["OFFERS"],),
    ),
}


def normalize_privilege_codes(privileges: list[str]) -> list[str]:
    normalized = [value.strip().upper() for value in privileges if value.strip()]
    return list(dict.fromkeys(normalized))


def list_privilege_definitions() -> list[PackagePrivilegeDefinition]:
    return list(_PRIVILEGE_DEFINITIONS.values())


def get_privilege_definition(code: str) -> PackagePrivilegeDefinition | None:
    return _PRIVILEGE_DEFINITIONS.get(code.strip().upper())


def get_invalid_privilege_codes(privileges: list[str]) -> list[str]:
    return sorted({value for value in privileges if value not in _PRIVILEGE_DEFINITIONS})


def list_modules_for_privileges(privileges: list[str]) -> list[PackageAccessModuleDefinition]:
    modules: list[PackageAccessModuleDefinition] = []
    seen_keys: set[str] = set()

    for code in normalize_privilege_codes(privileges):
        definition = get_privilege_definition(code)
        if definition is None:
            continue
        for module in definition.modules:
            if module.key in seen_keys:
                continue
            seen_keys.add(module.key)
            modules.append(module)

    return modules
