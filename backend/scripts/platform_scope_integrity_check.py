from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import app.db.init_models  # noqa: F401,E402


_VALID_SCOPE_KEYS = {
    "ops_viewer",
    "tenant_admin",
    "billing_admin",
    "security_admin",
}


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Audit super-admin platform scopes for invalid/missing values and optionally fix them."
        ),
    )
    parser.add_argument(
        "--database-url",
        default=None,
        help=(
            "SQLAlchemy URL override. If omitted, uses DATABASE_URL env var, "
            "Set DATABASE_URL environment variable to use a custom database URL."
        ),
    )
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Normalize invalid rows to canonical JSON payloads and commit updates.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print per-user issue details.",
    )
    return parser.parse_args()


def _normalize_scope_payload(raw_value: object) -> tuple[str, set[str]]:
    issues: set[str] = set()

    if raw_value is None:
        issues.add("missing")
        return "[]", issues

    if isinstance(raw_value, (bytes, bytearray)):
        try:
            decoded = raw_value.decode()
        except Exception:
            issues.add("invalid_encoding")
            return "[]", issues
    else:
        decoded = str(raw_value)

    decoded = decoded.strip()
    if not decoded:
        issues.add("blank")
        return "[]", issues

    try:
        parsed = json.loads(decoded)
    except Exception:
        issues.add("invalid_json")
        return "[]", issues

    if not isinstance(parsed, list):
        issues.add("not_list")
        return "[]", issues

    normalized: list[str] = []
    seen: set[str] = set()

    for item in parsed:
        candidate = str(item).strip().lower()
        if not candidate:
            issues.add("blank_entry")
            continue
        if candidate not in _VALID_SCOPE_KEYS:
            issues.add("unknown_scope")
            continue
        if candidate in seen:
            issues.add("duplicate_scope")
            continue
        normalized.append(candidate)
        seen.add(candidate)

    return json.dumps(normalized, ensure_ascii=True), issues


def main() -> int:
    args = _parse_args()
    database_url = (
        args.database_url
        or os.getenv("DATABASE_URL")
        or "" # Fail fast if not set - never use hardcoded credentials
    )
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL environment variable must be set. "
            "Never use hardcoded credentials. Example: "
            "export DATABASE_URL='mysql+pymysql://user:pass@localhost/db'"
        )
    )

    engine = create_engine(database_url, pool_pre_ping=True, future=True)
    session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = session_local()

    try:
        rows = db.execute(
            text(
                """
                SELECT id, email, platform_scopes_json
                FROM users
                WHERE role = 'super_admin'
                  AND restaurant_id IS NULL
                ORDER BY id ASC
                """
            )
        ).fetchall()

        if not rows:
            print("No platform-level super admin users found.")
            return 0

        totals = {
            "users": len(rows),
            "needs_fix": 0,
            "missing": 0,
            "blank": 0,
            "invalid_encoding": 0,
            "invalid_json": 0,
            "not_list": 0,
            "blank_entry": 0,
            "unknown_scope": 0,
            "duplicate_scope": 0,
            "empty_after_normalization": 0,
            "fixed": 0,
        }

        updates: list[dict[str, object]] = []

        for row in rows:
            user_id = int(row.id)
            email = str(row.email)
            raw_value = row.platform_scopes_json
            normalized, issues = _normalize_scope_payload(raw_value)

            for issue in issues:
                totals[issue] += 1

            if normalized == "[]":
                totals["empty_after_normalization"] += 1

            if raw_value != normalized:
                totals["needs_fix"] += 1
                updates.append(
                    {
                        "user_id": user_id,
                        "email": email,
                        "raw": raw_value,
                        "normalized": normalized,
                        "issues": sorted(issues),
                    }
                )

        print("Platform scope integrity summary")
        print("-" * 72)
        print(f"Total super admins               : {totals['users']}")
        print(f"Rows requiring normalization     : {totals['needs_fix']}")
        print(f"Rows empty after normalization   : {totals['empty_after_normalization']}")
        print("-" * 72)
        for key in (
            "missing",
            "blank",
            "invalid_encoding",
            "invalid_json",
            "not_list",
            "blank_entry",
            "unknown_scope",
            "duplicate_scope",
        ):
            print(f"{key:<32}: {totals[key]}")

        if args.verbose and updates:
            print("-" * 72)
            print("Rows requiring normalization")
            for item in updates:
                print(
                    f"- id={item['user_id']} email={item['email']} "
                    f"issues={','.join(item['issues']) or 'canonicalize'} "
                    f"normalized={item['normalized']}"
                )

        if args.fix and updates:
            for item in updates:
                db.execute(
                    text(
                        """
                        UPDATE users
                        SET platform_scopes_json = :platform_scopes_json
                        WHERE id = :user_id
                        """
                    ),
                    {
                        "platform_scopes_json": item["normalized"],
                        "user_id": item["user_id"],
                    },
                )
            db.commit()
            totals["fixed"] = len(updates)
            print("-" * 72)
            print(f"Applied normalization updates    : {totals['fixed']}")
        elif args.fix:
            print("-" * 72)
            print("No updates required. Database already normalized.")

        if totals["needs_fix"] > 0 and not args.fix:
            print("Result: FAIL (run with --fix after backup)")
            return 2

        print("Result: PASS")
        return 0
    finally:
        db.close()
        engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
