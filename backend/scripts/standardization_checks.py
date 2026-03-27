from __future__ import annotations

import ast
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

import sqlalchemy as sa

SNAKE_CASE_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
IGNORED_EXTRA_TABLES = {"alembic_version"}


@dataclass
class CheckResult:
    name: str
    ok: bool
    details: list[str] = field(default_factory=list)


def _backend_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _project_root() -> Path:
    return _backend_root().parent


def _ensure_backend_on_path() -> None:
    backend_path = str(_backend_root())
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)


def _load_metadata() -> sa.MetaData:
    _ensure_backend_on_path()
    import app.db.init_models  # noqa: F401
    from app.db.base import Base

    return Base.metadata


def check_metadata_naming() -> CheckResult:
    metadata = _load_metadata()
    violations: list[str] = []

    for table_name, table in sorted(metadata.tables.items()):
        if not SNAKE_CASE_PATTERN.fullmatch(table_name):
            violations.append(f"Table '{table_name}' must be snake_case.")
        for column in table.columns:
            if not SNAKE_CASE_PATTERN.fullmatch(column.name):
                violations.append(
                    f"Column '{table_name}.{column.name}' must be snake_case."
                )

    if violations:
        return CheckResult(
            name="Metadata naming convention",
            ok=False,
            details=violations,
        )
    return CheckResult(
        name="Metadata naming convention",
        ok=True,
        details=["All table and column names use snake_case."],
    )


def _modules_with_router() -> set[str]:
    modules_dir = _backend_root() / "app" / "modules"
    return {
        entry.name
        for entry in modules_dir.iterdir()
        if entry.is_dir() and (entry / "router.py").exists()
    }


def _extract_router_imports_and_usage(
    router_path: Path,
) -> tuple[set[str], dict[str, str], set[str]]:
    tree = ast.parse(router_path.read_text(encoding="utf-8"))
    imported_modules: set[str] = set()
    imported_aliases: dict[str, str] = {}
    included_aliases: set[str] = set()

    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            parts = node.module.split(".")
            if (
                len(parts) == 4
                and parts[0] == "app"
                and parts[1] == "modules"
                and parts[3] == "router"
            ):
                module_name = parts[2]
                imported_modules.add(module_name)
                for alias in node.names:
                    alias_name = alias.asname or alias.name
                    imported_aliases[alias_name] = module_name

        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "include_router"
            and node.args
            and isinstance(node.args[0], ast.Name)
        ):
            included_aliases.add(node.args[0].id)

    return imported_modules, imported_aliases, included_aliases


def check_router_registration() -> CheckResult:
    router_path = _backend_root() / "app" / "api" / "router.py"
    if not router_path.exists():
        return CheckResult(
            name="Module router registration",
            ok=False,
            details=[f"Missing API router file: {router_path}"],
        )

    expected_modules = _modules_with_router()
    imported_modules, imported_aliases, included_aliases = _extract_router_imports_and_usage(
        router_path
    )

    missing_module_imports = sorted(expected_modules - imported_modules)
    imported_but_not_included = sorted(
        {
            module
            for alias, module in imported_aliases.items()
            if alias not in included_aliases
        }
    )

    failures: list[str] = []
    if missing_module_imports:
        failures.append(
            "Modules with router.py missing import in app/api/router.py: "
            + ", ".join(missing_module_imports)
        )
    if imported_but_not_included:
        failures.append(
            "Router modules imported but not included with include_router(...): "
            + ", ".join(imported_but_not_included)
        )

    if failures:
        return CheckResult(
            name="Module router registration",
            ok=False,
            details=failures,
        )
    return CheckResult(
        name="Module router registration",
        ok=True,
        details=[
            f"All {len(expected_modules)} module routers are imported and registered."
        ],
    )


def check_compose_secret_injection(compose_file: Path | None = None) -> CheckResult:
    compose_path = compose_file or (_project_root() / "docker-compose.yml")
    if not compose_path.exists():
        return CheckResult(
            name="Compose secret injection",
            ok=False,
            details=[f"Missing compose file: {compose_path}"],
        )

    required_env_patterns = {
        "MYSQL_ROOT_PASSWORD": re.compile(
            r"^\s*MYSQL_ROOT_PASSWORD:\s*\$\{[^}]+\}\s*$",
        ),
        "DATABASE_URL": re.compile(
            r"^\s*DATABASE_URL:\s*\$\{[^}]+\}\s*$",
        ),
    }

    failures: list[str] = []
    for line_no, line in enumerate(compose_path.read_text(encoding="utf-8").splitlines(), start=1):
        for key, pattern in required_env_patterns.items():
            if line.lstrip().startswith(f"{key}:") and not pattern.search(line):
                failures.append(
                    f"{compose_path.name}:{line_no} has hardcoded {key}. Use env interpolation."
                )

    if failures:
        return CheckResult(
            name="Compose secret injection",
            ok=False,
            details=failures,
        )
    return CheckResult(
        name="Compose secret injection",
        ok=True,
        details=["docker-compose.yml uses environment variable interpolation for secrets."],
    )


def check_production_guardrails(
    app_env: str | None = None,
    secret_key: str | None = None,
    db_auto_schema_sync: bool | None = None,
) -> CheckResult:
    if app_env is None or secret_key is None or db_auto_schema_sync is None:
        _ensure_backend_on_path()
        from app.core.config import settings

        app_env = settings.app_env if app_env is None else app_env
        secret_key = settings.secret_key if secret_key is None else secret_key
        db_auto_schema_sync = (
            settings.db_auto_schema_sync
            if db_auto_schema_sync is None
            else db_auto_schema_sync
        )

    normalized_env = app_env.lower()
    if normalized_env != "production":
        return CheckResult(
            name="Production guardrails",
            ok=True,
            details=[f"APP_ENV is '{app_env}', production-only checks not enforced in this run."],
        )

    failures: list[str] = []
    weak_secret_values = {
        "",
        "change-this-in-production",
        "change-this-to-a-long-random-string",
    }
    if secret_key in weak_secret_values or len(secret_key) < 32:
        failures.append(
            "SECRET_KEY is weak for production. Use at least 32 random characters."
        )
    if db_auto_schema_sync:
        failures.append(
            "DB_AUTO_SCHEMA_SYNC is true in production. Disable it and run Alembic migrations."
        )

    if failures:
        return CheckResult(
            name="Production guardrails",
            ok=False,
            details=failures,
        )
    return CheckResult(
        name="Production guardrails",
        ok=True,
        details=["Production guardrails are satisfied."],
    )


def check_schema_drift(database_url: str | None) -> CheckResult:
    if not database_url:
        return CheckResult(
            name="Schema drift",
            ok=False,
            details=["No DATABASE_URL provided. Set env var or pass --database-url."],
        )

    metadata = _load_metadata()
    expected_tables = set(metadata.tables.keys())

    try:
        engine = sa.create_engine(database_url)
        with engine.connect() as connection:
            inspector = sa.inspect(connection)
            actual_tables = set(inspector.get_table_names())
    except Exception as exc:  # pragma: no cover - depends on runtime DB availability
        return CheckResult(
            name="Schema drift",
            ok=False,
            details=[f"Unable to inspect database schema: {exc}"],
        )
    finally:
        if "engine" in locals():
            engine.dispose()

    missing = sorted(expected_tables - actual_tables)
    unexpected = sorted(actual_tables - expected_tables - IGNORED_EXTRA_TABLES)

    details = [
        f"Expected tables: {len(expected_tables)}",
        f"Actual tables: {len(actual_tables)}",
    ]
    if missing:
        details.append("Missing tables: " + ", ".join(missing))
    if unexpected:
        details.append("Unexpected tables: " + ", ".join(unexpected))

    ok = not missing and not unexpected
    if ok:
        details.append("Database schema matches ORM metadata.")
    else:
        details.append("Run 'alembic upgrade head' against this DATABASE_URL to reconcile drift.")

    return CheckResult(
        name="Schema drift",
        ok=ok,
        details=details,
    )


def run_all_checks(database_url: str | None, skip_db: bool = False) -> list[CheckResult]:
    results = [
        check_metadata_naming(),
        check_router_registration(),
        check_compose_secret_injection(),
        check_production_guardrails(),
    ]
    if not skip_db:
        results.append(check_schema_drift(database_url))
    return results
