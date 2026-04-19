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
    """Extract alerts and load."""
    from src.config import get_config
    from src.ingestion.alerts import AlertsExtractor

    config = get_config()

    with AlertsExtractor() as extractor:
        path = extractor.run()

    if config.is_local:
        from src.loaders.duckdb_loader import DuckDBLoader

        rows = DuckDBLoader().load_parquet("alerts")
    else:
        from src.loaders.bigquery_loader import BigQueryLoader
        from src.loaders.gcs_loader import GCSLoader

        GCSLoader().upload_entity("alerts")
        rows = BigQueryLoader().load_from_gcs("alerts")

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
