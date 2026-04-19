"""DAG: Daily dimension extraction — routes, stops, trips, schedules, weather."""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator

default_args = {
    "owner": "mbta",
    "depends_on_past": False,
    "email_on_failure": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=2),
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


def extract_weather():
    """Extract weather data and load."""
    from src.config import get_config
    from src.ingestion.weather import WeatherExtractor

    config = get_config()

    with WeatherExtractor() as extractor:
        path = extractor.run()

    if config.is_local:
        from src.loaders.duckdb_loader import DuckDBLoader

        rows = DuckDBLoader().load_parquet("weather")
    else:
        from src.loaders.bigquery_loader import BigQueryLoader
        from src.loaders.gcs_loader import GCSLoader

        GCSLoader().upload_entity("weather")
        rows = BigQueryLoader().load_from_gcs("weather")

    return {"entity": "weather", "path": path, "rows": rows}


with DAG(
    dag_id="daily_dimensions",
    default_args=default_args,
    description="Extract and load MBTA dimension tables daily",
    schedule_interval="0 6 * * *",
    start_date=datetime(2025, 1, 1),
    catchup=False,
    tags=["mbta", "dimensions", "daily"],
) as dag:

    extract_routes = PythonOperator(
        task_id="extract_routes",
        python_callable=extract_and_load,
        op_kwargs={
            "extractor_class_path": "src.ingestion.routes.RoutesExtractor",
            "entity": "routes",
        },
    )

    extract_stops = PythonOperator(
        task_id="extract_stops",
        python_callable=extract_and_load,
        op_kwargs={
            "extractor_class_path": "src.ingestion.stops.StopsExtractor",
            "entity": "stops",
        },
    )

    extract_trips = PythonOperator(
        task_id="extract_trips",
        python_callable=extract_and_load,
        op_kwargs={
            "extractor_class_path": "src.ingestion.trips.TripsExtractor",
            "entity": "trips",
        },
    )

    extract_schedules = PythonOperator(
        task_id="extract_schedules",
        python_callable=extract_and_load,
        op_kwargs={
            "extractor_class_path": "src.ingestion.schedules.SchedulesExtractor",
            "entity": "schedules",
        },
    )

    weather = PythonOperator(
        task_id="extract_weather",
        python_callable=extract_weather,
    )

    [extract_routes, extract_stops, extract_trips, extract_schedules, weather]