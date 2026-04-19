"""DAG: Real-time fact extraction — predictions and vehicles every 5 minutes."""

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


def extract_and_load(extractor_class_path: str, entity: str):
    """Extract from API, upload to GCS, load to BigQuery."""
    import importlib

    from src.config import get_config

    config = get_config()

    module_path, class_name = extractor_class_path.rsplit(".", 1)
    module = importlib.import_module(module_path)
    ExtractorClass = getattr(module, class_name)

    with ExtractorClass() as extractor:
        path = extractor.run()

    if config.is_local:
        from src.loaders.duckdb_loader import DuckDBLoader

        rows = DuckDBLoader().load_parquet(entity)
    else:
        from src.loaders.bigquery_loader import BigQueryLoader
        from src.loaders.gcs_loader import GCSLoader

        GCSLoader().upload_entity(entity)
        rows = BigQueryLoader().load_from_gcs(entity)

    return {"entity": entity, "path": path, "rows": rows}


with DAG(
    dag_id="realtime_facts",
    default_args=default_args,
    description="Extract real-time predictions and vehicle positions",
    schedule_interval="*/5 * * * *",
    start_date=datetime(2025, 1, 1),
    catchup=False,
    tags=["mbta", "facts", "realtime"],
) as dag:

    extract_predictions = PythonOperator(
        task_id="extract_predictions",
        python_callable=extract_and_load,
        op_kwargs={
            "extractor_class_path": "src.ingestion.predictions.PredictionsExtractor",
            "entity": "predictions",
        },
    )

    extract_vehicles = PythonOperator(
        task_id="extract_vehicles",
        python_callable=extract_and_load,
        op_kwargs={
            "extractor_class_path": "src.ingestion.vehicles.VehiclesExtractor",
            "entity": "vehicles",
        },
    )

    [extract_predictions, extract_vehicles]