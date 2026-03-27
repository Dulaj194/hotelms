from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from standardization_checks import CheckResult, run_all_checks


def _print_result(result: CheckResult) -> None:
    status = "PASS" if result.ok else "FAIL"
    print(f"[{status}] {result.name}")
    for detail in result.details:
        print(f"  - {detail}")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run project standardization checks.",
    )
    parser.add_argument(
        "--database-url",
        default=None,
        help="SQLAlchemy database URL used for schema drift check.",
    )
    parser.add_argument(
        "--skip-db",
        action="store_true",
        help="Skip live database schema drift check.",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    database_url = args.database_url or os.getenv("DATABASE_URL")
    results = run_all_checks(database_url=database_url, skip_db=args.skip_db)

    print("Standardization pass report")
    print("-" * 80)
    for result in results:
        _print_result(result)
    print("-" * 80)

    failed = [result.name for result in results if not result.ok]
    if failed:
        print("Overall: FAIL")
        print("Failed checks: " + ", ".join(failed))
        return 1

    print("Overall: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

