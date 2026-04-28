"""DAG: Daily dimension extraction -- routes, stops, trips, schedules (all modes), weather."""

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

BUS_ROUTES = [
    "1", "10", "100", "101", "104", "105", "106", "108", "109", "11",
    "110", "111", "112", "114", "116", "119", "120", "121", "131", "132",
    "134", "137", "14", "15", "16", "17", "171", "18", "19", "201",
    "202", "21", "210", "211", "215", "216", "217", "22", "220", "222",
    "225", "226", "23", "230", "236", "238", "24", "240", "245", "26",
    "28", "29", "30", "31", "32", "33", "34", "34E", "35", "350",
    "351", "354", "36", "37", "38", "39", "4", "40", "41", "411",
    "42", "424", "426", "428", "429", "43", "430", "435", "436", "439",
    "44", "441", "442", "45", "450", "451", "455", "456", "47", "50",
    "501", "504", "505", "51", "52", "55", "553", "554", "556", "558",
]

SCHEDULE_BUS_BATCH_SIZE = 10


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
        rows = DuckDBLoader().load_parquet(entity, parquet_path=path)
    else:
        from src.loaders.bigquery_loader import BigQueryLoader
        from src.loaders.gcs_loader import GCSLoader
        gcs_uri = GCSLoader().upload_parquet(path)
        rows = BigQueryLoader().load_from_gcs(entity, gcs_uri)

    return {"entity": entity, "path": path, "rows": rows}


def extract_bus_schedules_batch(batch_index: int):
    """Extract schedules for a batch of bus routes."""
    from src.config import get_config
    from src.ingestion.schedules import SchedulesExtractor

    config = get_config()
    start = batch_index * SCHEDULE_BUS_BATCH_SIZE
    batch = BUS_ROUTES[start : start + SCHEDULE_BUS_BATCH_SIZE]

    if not batch:
        return {"entity": "schedules_bus", "batch": batch_index, "rows": 0}

    total_rows = 0

    with SchedulesExtractor() as extractor:
        try:
            records = extractor.extract_for_routes(batch)
            if records:
                df = extractor.to_dataframe(records)
                path = extractor.save(df)

                if config.is_local:
                    from src.loaders.duckdb_loader import DuckDBLoader
                    total_rows = DuckDBLoader().load_parquet("schedules", parquet_path=path)
                else:
                    from src.loaders.bigquery_loader import BigQueryLoader
                    from src.loaders.gcs_loader import GCSLoader
                    gcs_uri = GCSLoader().upload_parquet(path)
                    total_rows = BigQueryLoader().load_from_gcs("schedules", gcs_uri)
        except Exception as e:
            print(f"Bus schedule batch {batch_index} failed: {e}")

    return {"entity": "schedules_bus", "batch": batch_index, "rows": total_rows}


def extract_weather():
    """Extract weather data and load."""
    from src.config import get_config
    from src.ingestion.weather import WeatherExtractor

    config = get_config()

    with WeatherExtractor() as extractor:
        path = extractor.run()

    if config.is_local:
        from src.loaders.duckdb_loader import DuckDBLoader
        rows = DuckDBLoader().load_parquet("weather", parquet_path=path)
    else:
        from src.loaders.bigquery_loader import BigQueryLoader
        from src.loaders.gcs_loader import GCSLoader
        gcs_uri = GCSLoader().upload_parquet(path)
        rows = BigQueryLoader().load_from_gcs("weather", gcs_uri)

    return {"entity": "weather", "path": path, "rows": rows}

num_schedule_bus_batches = (
    (len(BUS_ROUTES) + SCHEDULE_BUS_BATCH_SIZE - 1) // SCHEDULE_BUS_BATCH_SIZE
)



with DAG(
    dag_id="daily_dimensions",
    default_args=default_args,
    description="Extract and load MBTA dimension tables daily (all modes)",
    schedule_interval="10 7 * * *",
    start_date=datetime(2025, 1, 1),
    max_active_runs=1,
    max_active_tasks=3,
    dagrun_timeout=timedelta(minutes=45),
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

    # Rail + Ferry schedules (default params)
    extract_schedules_rail = PythonOperator(
        task_id="extract_schedules_rail_ferry",
        python_callable=extract_and_load,
        op_kwargs={
            "extractor_class_path": "src.ingestion.schedules.SchedulesExtractor",
            "entity": "schedules",
        },
    )

    # Bus schedules in batches
    bus_schedule_tasks = []
    for i in range(num_schedule_bus_batches):
        task = PythonOperator(
            task_id=f"extract_schedules_bus_batch_{i}",
            python_callable=extract_bus_schedules_batch,
            op_kwargs={"batch_index": i},
        )
        bus_schedule_tasks.append(task)

    weather = PythonOperator(
        task_id="extract_weather",
        python_callable=extract_weather,
    )

    # Dependencies: routes/stops first, then schedules need routes
    [extract_routes, extract_stops] >> extract_trips
    extract_trips >> extract_schedules_rail >> bus_schedule_tasks
    weather
