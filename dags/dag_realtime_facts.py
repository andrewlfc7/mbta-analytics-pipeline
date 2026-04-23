"""DAG: Real-time fact extraction -- predictions (all modes) and vehicles every hour."""

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

# Bus routes -- batched separately because MBTA API can't handle 100+ routes
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

BUS_BATCH_SIZE = 20


def extract_rail_ferry_predictions():
    """Extract predictions for all rail + ferry routes (default params)."""
    from src.config import get_config
    from src.ingestion.predictions import PredictionsExtractor

    config = get_config()

    with PredictionsExtractor() as extractor:
        path = extractor.run()

    if config.is_local:
        from src.loaders.duckdb_loader import DuckDBLoader
        rows = DuckDBLoader().load_parquet("predictions", parquet_path=path)
    else:
        from src.loaders.bigquery_loader import BigQueryLoader
        from src.loaders.gcs_loader import GCSLoader
        gcs_uri = GCSLoader().upload_parquet(path)
        rows = BigQueryLoader().load_from_gcs("predictions", gcs_uri)

    return {"entity": "predictions_rail_ferry", "path": path, "rows": rows}


def extract_bus_predictions_batch(batch_index: int):
    """Extract predictions for a batch of bus routes."""
    from src.config import get_config
    from src.ingestion.predictions import PredictionsExtractor

    config = get_config()
    start = batch_index * BUS_BATCH_SIZE
    batch = BUS_ROUTES[start : start + BUS_BATCH_SIZE]

    if not batch:
        return {"entity": "predictions_bus", "batch": batch_index, "rows": 0}

    total_rows = 0

    with PredictionsExtractor() as extractor:
        try:
            records = extractor.extract_for_routes(batch)
            if records:
                df = extractor.to_dataframe(records)
                path = extractor.save(df)

                if config.is_local:
                    from src.loaders.duckdb_loader import DuckDBLoader
                    total_rows = DuckDBLoader().load_parquet("predictions", parquet_path=path)
                else:
                    from src.loaders.bigquery_loader import BigQueryLoader
                    from src.loaders.gcs_loader import GCSLoader
                    gcs_uri = GCSLoader().upload_parquet(path)
                    total_rows = BigQueryLoader().load_from_gcs("predictions", gcs_uri)
        except Exception as e:
            print(f"Bus batch {batch_index} failed: {e}")

    return {"entity": "predictions_bus", "batch": batch_index, "rows": total_rows}


def extract_vehicles():
    """Extract vehicle positions."""
    from src.config import get_config
    from src.ingestion.vehicles import VehiclesExtractor

    config = get_config()

    with VehiclesExtractor() as extractor:
        path = extractor.run()

    if config.is_local:
        from src.loaders.duckdb_loader import DuckDBLoader
        rows = DuckDBLoader().load_parquet("vehicles", parquet_path=path)
    else:
        from src.loaders.bigquery_loader import BigQueryLoader
        from src.loaders.gcs_loader import GCSLoader
        gcs_uri = GCSLoader().upload_parquet(path)
        rows = BigQueryLoader().load_from_gcs("vehicles", gcs_uri)

    return {"entity": "vehicles", "path": path, "rows": rows}


# Calculate number of bus batches
num_bus_batches = (len(BUS_ROUTES) + BUS_BATCH_SIZE - 1) // BUS_BATCH_SIZE


with DAG(
    dag_id="realtime_facts",
    default_args=default_args,
    description="Extract real-time predictions (all modes) and vehicle positions",
    schedule_interval="0 * * * *",
    start_date=datetime(2025, 1, 1),
    max_active_runs=1,
    max_active_tasks=3,
    dagrun_timeout=timedelta(minutes=15),
    catchup=False,
    tags=["mbta", "facts", "realtime"],
) as dag:

    # Rail + Ferry predictions (one call, 27 routes)
    rail_ferry = PythonOperator(
        task_id="extract_predictions_rail_ferry",
        python_callable=extract_rail_ferry_predictions,
    )

    # Bus predictions (batched, ~5 tasks)
    bus_tasks = []
    for i in range(num_bus_batches):
        task = PythonOperator(
            task_id=f"extract_predictions_bus_batch_{i}",
            python_callable=extract_bus_predictions_batch,
            op_kwargs={"batch_index": i},
        )
        bus_tasks.append(task)

    # Vehicles
    vehicles = PythonOperator(
        task_id="extract_vehicles",
        python_callable=extract_vehicles,
    )

    # Rail/ferry runs first, then bus batches in parallel, vehicles independent
    rail_ferry >> bus_tasks
    vehicles
