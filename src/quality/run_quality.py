"""Run data quality checks — CLI entry point."""

from src.config import get_config
from src.quality.validators import validate_all_bigquery, validate_all_local


def main() -> int:
    config = get_config()

    print(f"\nRunning data quality checks (env={config.env})...\n")

    if config.is_local:
        results = validate_all_local()
    else:
        results = validate_all_bigquery()

    all_passed = True
    for entity, suite in results.items():
        print(suite.summary())
        if not suite.passed:
            all_passed = False

    # Overall summary
    total_checks = sum(len(s.results) for s in results.values())
    total_passed = sum(s.pass_count for s in results.values())
    total_failed = sum(s.fail_count for s in results.values())

    print(f"\n{'='*50}")
    print(f"  OVERALL: {total_passed}/{total_checks} checks passed")
    if total_failed:
        print(f"  {total_failed} FAILURES")
    print(f"{'='*50}\n")

    return 0 if all_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())