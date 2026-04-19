"""DAG: Alert extraction every 15 minutes."""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator

default_args = {
    "owner": "mbta",
    "depends_on_past": False,
    "email_on_failure": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=1),
}


def extract_alerts():
    """Extract alerts and load to DuckDB."""
    from src.ingestion.alerts import AlertsExtractor
    from src.loaders.duckdb_loader import DuckDBLoader

    with AlertsExtractor() as extractor:
        path = extractor.run()

    loader = DuckDBLoader()
    rows = loader.load_parquet("alerts")
    return {"entity": "alerts", "path": path, "rows": rows}


with DAG(
    dag_id="alerts",
    default_args=default_args,
    description="Extract MBTA service alerts",
    schedule_interval="*/15 * * * *",
    start_date=datetime(2025, 1, 1),
    catchup=False,
    tags=["mbta", "alerts"],
) as dag:

    extract = PythonOperator(
        task_id="extract_alerts",
        python_callable=extract_alerts,
    )