"""
Ingest predictions + schedules for ALL transit modes.
Uses existing extractors and saves via the standard pipeline.

Run: python -m src.ingestion.ingest_all_modes
"""

import time
import logging
import sys

from src.ingestion.predictions import PredictionsExtractor
from src.ingestion.schedules import SchedulesExtractor

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


def run_predictions():
    """Fetch predictions for all modes."""
    logger.info("--- PREDICTIONS ---")

    with PredictionsExtractor() as extractor:
        # Step 1: Rail + Ferry (default params now include all non-bus)
        logger.info("Fetching rail + ferry predictions (27 routes)...")
        try:
            rail_path = extractor.run()
            logger.info(f"Rail + ferry saved to: {rail_path}")
        except Exception as e:
            logger.error(f"Rail + ferry predictions failed: {e}")

        # Step 2: Bus in batches
        total_batches = (len(BUS_ROUTES) + PREDICTION_BATCH_SIZE - 1) // PREDICTION_BATCH_SIZE
        for i in range(0, len(BUS_ROUTES), PREDICTION_BATCH_SIZE):
            batch = BUS_ROUTES[i : i + PREDICTION_BATCH_SIZE]
            batch_num = i // PREDICTION_BATCH_SIZE + 1
            logger.info(
                f"Bus predictions batch {batch_num}/{total_batches}: "
                f"routes {batch[0]}..{batch[-1]}"
            )

            try:
                records = extractor.extract_for_routes(batch)
                if records:
                    df = extractor.to_dataframe(records)
                    path = extractor.save(df)
                    logger.info(f"  -> {len(records)} predictions saved to {path}")
                else:
                    logger.info(f"  -> 0 predictions (no active service)")
            except Exception as e:
                logger.warning(f"  -> Batch {batch_num} failed: {e}")

            time.sleep(1)


def run_schedules():
    """Fetch schedules for all modes."""
    logger.info("--- SCHEDULES ---")

    with SchedulesExtractor() as extractor:
        # Step 1: Rail + Ferry
        logger.info("Fetching rail + ferry schedules (27 routes)...")
        try:
            rail_path = extractor.run()
            logger.info(f"Rail + ferry saved to: {rail_path}")
        except Exception as e:
            logger.error(f"Rail + ferry schedules failed: {e}")

        # Step 2: Bus in batches
        total_batches = (len(BUS_ROUTES) + SCHEDULE_BATCH_SIZE - 1) // SCHEDULE_BATCH_SIZE
        for i in range(0, len(BUS_ROUTES), SCHEDULE_BATCH_SIZE):
            batch = BUS_ROUTES[i : i + SCHEDULE_BATCH_SIZE]
            batch_num = i // SCHEDULE_BATCH_SIZE + 1
            logger.info(
                f"Bus schedules batch {batch_num}/{total_batches}: "
                f"routes {batch[0]}..{batch[-1]}"
            )

            try:
                records = extractor.extract_for_routes(batch)
                if records:
                    df = extractor.to_dataframe(records)
                    path = extractor.save(df)
                    logger.info(f"  -> {len(records)} schedule entries saved to {path}")
                else:
                    logger.info(f"  -> 0 entries")
            except Exception as e:
                logger.warning(f"  -> Batch {batch_num} failed: {e}")

            time.sleep(1)


def main():
    logger.info("=" * 50)
    logger.info("ALL-MODES INGESTION")
    logger.info("=" * 50)

    run_predictions()
    logger.info("")
    run_schedules()

    logger.info("")
    logger.info("=" * 50)
    logger.info("INGESTION COMPLETE")
    logger.info("=" * 50)
    logger.info("Next steps:")
    logger.info("  1. Upload parquet to GCS (if not automatic)")
    logger.info("  2. Run BigQueryLoader to load GCS -> BigQuery")
    logger.info("  3. cd dbt_mbta && dbt run --full-refresh --profiles-dir . --target prod")


if __name__ == "__main__":
    main()