"""
One-time backfill: Ingest predictions + schedules for ALL transit modes.
Uses the existing pipeline: extract -> local parquet -> GCS -> BigQuery.

Run on VM: MBTA_ENV=gcp python -m src.ingestion.ingest_all_modes
"""

import logging
import time

from src.config import get_config
from src.ingestion.predictions import PredictionsExtractor
from src.ingestion.schedules import SchedulesExtractor
from src.loaders.bigquery_loader import BigQueryLoader
from src.loaders.gcs_loader import GCSLoader

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("ingest_all_modes")

# Actual bus route IDs from BigQuery (route_type = 3)
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

PREDICTION_BATCH_SIZE = 20
SCHEDULE_BATCH_SIZE = 10


def upload_and_load(local_path: str, entity: str, gcs_loader: GCSLoader,
                    bq_loader: BigQueryLoader) -> int:
    """Upload parquet to GCS, then load into BigQuery."""
    gcs_uri = gcs_loader.upload_parquet(local_path)
    rows = bq_loader.load_from_gcs(entity, gcs_uri)
    return rows


def run_predictions(gcs_loader: GCSLoader, bq_loader: BigQueryLoader):
    """Fetch predictions for all modes."""
    logger.info("--- PREDICTIONS ---")
    total = 0

    with PredictionsExtractor() as extractor:
        # Step 1: Rail + Ferry (27 routes in default params)
        logger.info("Fetching rail + ferry predictions (27 routes)...")
        try:
            path = extractor.run()
            rows = upload_and_load(path, "predictions", gcs_loader, bq_loader)
            total += rows
            logger.info(f"Rail + ferry: {rows} rows loaded")
        except Exception as e:
            logger.error(f"Rail + ferry predictions failed: {e}")

        # Step 2: Bus in batches
        total_batches = (len(BUS_ROUTES) + PREDICTION_BATCH_SIZE - 1) // PREDICTION_BATCH_SIZE
        for i in range(0, len(BUS_ROUTES), PREDICTION_BATCH_SIZE):
            batch = BUS_ROUTES[i : i + PREDICTION_BATCH_SIZE]
            batch_num = i // PREDICTION_BATCH_SIZE + 1
            logger.info(
                f"Bus predictions {batch_num}/{total_batches}: "
                f"routes {batch[0]}..{batch[-1]}"
            )

            try:
                records = extractor.extract_for_routes(batch)
                if records:
                    df = extractor.to_dataframe(records)
                    path = extractor.save(df)
                    rows = upload_and_load(path, "predictions", gcs_loader, bq_loader)
                    total += rows
                    logger.info(f"  -> {rows} rows loaded")
                else:
                    logger.info("  -> 0 predictions (no active service)")
            except Exception as e:
                logger.warning(f"  -> Batch {batch_num} failed: {e}")

            time.sleep(1)

    logger.info(f"Total predictions loaded: {total}")
    return total


def run_schedules(gcs_loader: GCSLoader, bq_loader: BigQueryLoader):
    """Fetch schedules for all modes."""
    logger.info("--- SCHEDULES ---")
    total = 0

    with SchedulesExtractor() as extractor:
        # Step 1: Rail + Ferry
        logger.info("Fetching rail + ferry schedules (27 routes)...")
        try:
            path = extractor.run()
            rows = upload_and_load(path, "schedules", gcs_loader, bq_loader)
            total += rows
            logger.info(f"Rail + ferry: {rows} rows loaded")
        except Exception as e:
            logger.error(f"Rail + ferry schedules failed: {e}")

        # Step 2: Bus in batches
        total_batches = (len(BUS_ROUTES) + SCHEDULE_BATCH_SIZE - 1) // SCHEDULE_BATCH_SIZE
        for i in range(0, len(BUS_ROUTES), SCHEDULE_BATCH_SIZE):
            batch = BUS_ROUTES[i : i + SCHEDULE_BATCH_SIZE]
            batch_num = i // SCHEDULE_BATCH_SIZE + 1
            logger.info(
                f"Bus schedules {batch_num}/{total_batches}: "
                f"routes {batch[0]}..{batch[-1]}"
            )

            try:
                records = extractor.extract_for_routes(batch)
                if records:
                    df = extractor.to_dataframe(records)
                    path = extractor.save(df)
                    rows = upload_and_load(path, "schedules", gcs_loader, bq_loader)
                    total += rows
                    logger.info(f"  -> {rows} rows loaded")
                else:
                    logger.info("  -> 0 entries")
            except Exception as e:
                logger.warning(f"  -> Batch {batch_num} failed: {e}")

            time.sleep(1)

    logger.info(f"Total schedule entries loaded: {total}")
    return total


def main():
    config = get_config()
    logger.info("=" * 50)
    logger.info("ALL-MODES INGESTION")
    logger.info(f"Environment: {config.env}")
    logger.info(f"Bucket: {config.gcp.bucket}")
    logger.info(f"Dataset: {config.gcp.dataset}")
    logger.info("=" * 50)

    if config.is_local:
        logger.info("Running in LOCAL mode -- saving to local parquet only")
        logger.info("Set MBTA_ENV=gcp to upload to GCS + BigQuery")

        with PredictionsExtractor() as ext:
            path = ext.run()
            logger.info(f"Predictions saved: {path}")

        with SchedulesExtractor() as ext:
            path = ext.run()
            logger.info(f"Schedules saved: {path}")

        # Still do bus batches locally
        with PredictionsExtractor() as ext:
            for i in range(0, len(BUS_ROUTES), PREDICTION_BATCH_SIZE):
                batch = BUS_ROUTES[i : i + PREDICTION_BATCH_SIZE]
                try:
                    records = ext.extract_for_routes(batch)
                    if records:
                        df = ext.to_dataframe(records)
                        path = ext.save(df)
                        logger.info(f"Bus predictions batch saved: {path}")
                except Exception as e:
                    logger.warning(f"Bus batch failed: {e}")
                time.sleep(1)

        with SchedulesExtractor() as ext:
            for i in range(0, len(BUS_ROUTES), SCHEDULE_BATCH_SIZE):
                batch = BUS_ROUTES[i : i + SCHEDULE_BATCH_SIZE]
                try:
                    records = ext.extract_for_routes(batch)
                    if records:
                        df = ext.to_dataframe(records)
                        path = ext.save(df)
                        logger.info(f"Bus schedules batch saved: {path}")
                except Exception as e:
                    logger.warning(f"Bus batch failed: {e}")
                time.sleep(1)

        logger.info("Local ingestion complete.")
        logger.info("To upload: python -m src.loaders.gcs_loader")
        logger.info("To load BQ: python -m src.loaders.bigquery_loader")
        return

    # GCP mode: full pipeline
    gcs_loader = GCSLoader()
    bq_loader = BigQueryLoader()

    pred_total = run_predictions(gcs_loader, bq_loader)
    logger.info("")
    sched_total = run_schedules(gcs_loader, bq_loader)

    logger.info("")
    logger.info("=" * 50)
    logger.info("INGESTION COMPLETE")
    logger.info(f"  Predictions: {pred_total} rows")
    logger.info(f"  Schedules:   {sched_total} rows")
    logger.info("=" * 50)
    logger.info("")
    logger.info("Next: cd dbt_mbta && dbt run --full-refresh --profiles-dir . --target prod")


if __name__ == "__main__":
    main()
