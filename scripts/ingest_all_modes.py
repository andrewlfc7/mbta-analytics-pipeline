"""
Ingest predictions + schedules for ALL transit modes.
Uses existing extractors and BigQuery loader.

Run: python -m scripts.ingest_all_modes
"""

import time
import logging
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.ingestion.predictions import PredictionsExtractor
from src.ingestion.schedules import SchedulesExtractor
from src.loaders.bigquery_loader import BigQueryLoader  # adjust if different

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("ingest_all_modes")

# Bus routes -- too many for one API call, batch them
# You can also pull these from BigQuery: SELECT route_id FROM raw_mbta.raw_routes WHERE route_type = 3
BUS_ROUTES = [
    "1", "4", "7", "8", "9", "10", "11", "14", "15", "16", "17", "18", "19", "21",
    "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34",
    "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "47", "50",
    "51", "52", "55", "57", "59", "60", "61", "62", "64", "65", "66", "67", "68",
    "69", "70", "71", "73", "74", "75", "76", "77", "78", "79", "80", "83", "85",
    "86", "87", "88", "89", "90", "91", "92", "93", "94", "95", "96", "97", "99",
    "100", "101", "104", "105", "106", "108", "109", "110", "111", "112", "114",
    "116", "117", "119", "120", "121", "131", "132", "134", "136", "137",
    "170", "171", "191", "192", "193", "194", "195", "201", "202", "210", "211",
    "212", "214", "215", "216", "217", "220", "221", "222", "225", "226", "230",
    "236", "238", "240", "245", "350", "351", "354", "411", "424", "426", "428",
    "429", "430", "434", "435", "436", "439", "441", "442", "450", "451", "455",
    "456", "501", "502", "503", "504", "505",
]

BUS_BATCH_SIZE = 20


def run_predictions():
    """Fetch predictions for all modes."""
    logger.info("--- PREDICTIONS ---")

    with PredictionsExtractor() as extractor:
        # Step 1: Rail + Ferry (default params now include all non-bus)
        logger.info("Fetching rail + ferry predictions...")
        rail_path = extractor.run()
        logger.info(f"Rail + ferry saved to: {rail_path}")

        # Step 2: Bus in batches
        for i in range(0, len(BUS_ROUTES), BUS_BATCH_SIZE):
            batch = BUS_ROUTES[i : i + BUS_BATCH_SIZE]
            batch_num = i // BUS_BATCH_SIZE + 1
            total_batches = (len(BUS_ROUTES) + BUS_BATCH_SIZE - 1) // BUS_BATCH_SIZE
            logger.info(
                f"Fetching bus predictions batch {batch_num}/{total_batches}: "
                f"{batch[0]}...{batch[-1]}"
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

            time.sleep(1)  # Rate limiting


def run_schedules():
    """Fetch schedules for all modes."""
    logger.info("--- SCHEDULES ---")

    with SchedulesExtractor() as extractor:
        # Step 1: Rail + Ferry
        logger.info("Fetching rail + ferry schedules...")
        rail_path = extractor.run()
        logger.info(f"Rail + ferry saved to: {rail_path}")

        # Step 2: Bus in batches (smaller batches -- schedules return more data)
        batch_size = 10
        for i in range(0, len(BUS_ROUTES), batch_size):
            batch = BUS_ROUTES[i : i + batch_size]
            batch_num = i // batch_size + 1
            total_batches = (len(BUS_ROUTES) + batch_size - 1) // batch_size
            logger.info(
                f"Fetching bus schedules batch {batch_num}/{total_batches}: "
                f"{batch[0]}...{batch[-1]}"
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
    run_schedules()

    logger.info("=" * 50)
    logger.info("INGESTION COMPLETE")
    logger.info("=" * 50)
    logger.info("")
    logger.info("Next steps:")
    logger.info("  1. Load parquet files to BigQuery (if not auto-loaded)")
    logger.info("  2. cd dbt_mbta && dbt run --full-refresh --profiles-dir . --target prod")


if __name__ == "__main__":
    main()