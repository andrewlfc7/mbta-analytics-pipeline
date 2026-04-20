"""DAG: Daily data quality checks."""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator

default_args = {
    "owner": "mbta",
    "depends_on_past": False,
    "email_on_failure": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=2),
}


def check_data_freshness():
    """Verify raw data has been updated recently."""
    from datetime import datetime, timezone
    from pathlib import Path

    raw_path = Path("./data/raw")
    stale_entities = []
    now = datetime.now(timezone.utc)

    entities = [
        "routes", "stops", "predictions", "vehicles", "alerts", "weather",
    ]
    for entity in entities:
        entity_path = raw_path / entity
        if not entity_path.exists():
            stale_entities.append((entity, "missing"))
            continue

        parquet_files = list(entity_path.glob("**/*.parquet"))
        if not parquet_files:
            stale_entities.append((entity, "no files"))
            continue

        latest = max(f.stat().st_mtime for f in parquet_files)
        age_hours = (now.timestamp() - latest) / 3600

        if entity in ["predictions", "vehicles"] and age_hours > 0.5:
            stale_entities.append((entity, f"stale ({age_hours:.1f}h)"))
        elif age_hours > 25:
            stale_entities.append((entity, f"stale ({age_hours:.1f}h)"))

    if stale_entities:
        stale_msg = "\n".join(
            f"  {e}: {reason}" for e, reason in stale_entities
        )
        msg = f"Stale data detected:\n{stale_msg}"
        print(msg)
        raise ValueError(msg)

    print("All data sources are fresh")


def run_quality_checks():
    """Run data quality validation on all entities."""
    from src.config import get_config
    from src.quality.validators import (
        validate_all_bigquery,
        validate_all_local,
    )

    config = get_config()

    if config.is_local:
        results = validate_all_local()
    else:
        results = validate_all_bigquery()

    failures = []
    for entity, suite in results.items():
        print(suite.summary())
        if not suite.passed:
            failures.append(entity)

    if failures:
        raise ValueError(
            f"Data quality checks failed for: {', '.join(failures)}"
        )

    print("\nAll data quality checks passed!")


def check_row_counts():
    """Verify minimum row counts in warehouse."""
    from src.config import get_config

    config = get_config()

    if config.is_local:
        from src.loaders.duckdb_loader import DuckDBLoader

        stats = DuckDBLoader().table_stats()
    else:
        from src.loaders.bigquery_loader import BigQueryLoader

        stats = BigQueryLoader().table_stats()

    minimums = {
        "raw_routes": 100,
        "raw_stops": 5000,
        "raw_predictions": 500,
        "raw_vehicles": 10,
    }

    failures = []
    for table, min_rows in minimums.items():
        actual = stats.get(table, 0)
        if actual < min_rows:
            failures.append(f"{table}: {actual} rows (min: {min_rows})")

    if failures:
        msg = "Row count checks failed:\n" + "\n".join(
            f"  {f}" for f in failures
        )
        print(msg)
        raise ValueError(msg)

    print("All row count checks passed")
    for table, count in stats.items():
        print(f"  {table}: {count:,} rows")


with DAG(
    dag_id="data_quality",
    default_args=default_args,
    description="Daily data quality and freshness checks",
    schedule_interval="30 7 * * *",
    start_date=datetime(2025, 1, 1),
    max_active_runs=1,
    max_active_tasks=1,
    dagrun_timeout=timedelta(minutes=15),
    catchup=False,
    tags=["mbta", "quality"],
) as dag:

    freshness = PythonOperator(
        task_id="check_data_freshness",
        python_callable=check_data_freshness,
    )

    quality = PythonOperator(
        task_id="run_quality_checks",
        python_callable=run_quality_checks,
    )

    row_counts = PythonOperator(
        task_id="check_row_counts",
        python_callable=check_row_counts,
    )

    freshness >> quality >> row_counts
