from __future__ import annotations

from dataclasses import dataclass

from app.modules.access import catalog as access_catalog


@dataclass(frozen=True)
class PackagePrivilegeDefinition:
    code: str
    label: str
    description: str
    modules: tuple[access_catalog.AccessModuleDefinition | None, ...]

_PRIVILEGE_DEFINITIONS = {
    "QR_MENU": PackagePrivilegeDefinition(
        code="QR_MENU",
        label="QR Menu",
        description="Enables table and room QR ordering operations.",
        modules=(
            access_catalog.get_module_definition("orders"),
            access_catalog.get_module_definition("qr"),
            access_catalog.get_module_definition("kds"),
            access_catalog.get_module_definition("reports"),
            access_catalog.get_module_definition("billing"),
        ),
    ),
    "HOUSEKEEPING": PackagePrivilegeDefinition(
        code="HOUSEKEEPING",
        label="Housekeeping",
        description="Enables housekeeping workflows and room task management.",
        modules=(access_catalog.get_module_definition("housekeeping"),),
    ),
    "OFFERS": PackagePrivilegeDefinition(
        code="OFFERS",
        label="Offers",
        description="Enables promotional offers and discount campaign tools.",
        modules=(access_catalog.get_module_definition("offers"),),
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


def list_modules_for_privileges(privileges: list[str]) -> list[access_catalog.AccessModuleDefinition]:
    modules: list[access_catalog.AccessModuleDefinition] = []
    seen_keys: set[str] = set()

    for code in normalize_privilege_codes(privileges):
        definition = get_privilege_definition(code)
        if definition is None:
            continue
        for module in definition.modules:
            if module is None:
                continue
            if module.key in seen_keys:
                continue
            seen_keys.add(module.key)
            modules.append(module)

    return modules
