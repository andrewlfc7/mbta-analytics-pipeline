"""Bulk reload all raw parquet files into DuckDB.

Run this after closing notebooks / when DuckDB is free.
"""

from src.loaders.duckdb_loader import DuckDBLoader
from src.utils.logger import get_logger

logger = get_logger("reload")


def main():
    """Drop and reload all raw tables from parquet files."""
    loader = DuckDBLoader()

    logger.info("starting_bulk_reload")
    results = loader.load_all()

    print("\n" + "=" * 50)
    print("BULK RELOAD RESULTS")
    print("=" * 50)
    for entity, count in results.items():
        status = "✓" if count > 0 else "⚠" if count == 0 else "✗"
        print(f"  {status} {entity:<15} {count:>10} rows")

    total = sum(c for c in results.values() if c > 0)
    print(f"\nTotal rows loaded: {total:,}")
    logger.info("bulk_reload_complete", total_rows=total)


if __name__ == "__main__":
    main()