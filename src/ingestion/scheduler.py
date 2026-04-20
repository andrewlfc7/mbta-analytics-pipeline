"""Simple scheduler to accumulate data over time.

Extraction saves parquet files to raw layer (never fails due to locks).
DuckDB loading is attempted but failures are non-fatal since raw parquet
files are the source of truth and can be bulk-loaded later.
"""

import time
from datetime import datetime, timezone

import schedule

from src.ingestion.alerts import AlertsExtractor
from src.ingestion.predictions import PredictionsExtractor
from src.ingestion.routes import RoutesExtractor
from src.ingestion.schedules import SchedulesExtractor
from src.ingestion.stops import StopsExtractor
from src.ingestion.trips import TripsExtractor
from src.ingestion.vehicles import VehiclesExtractor
from src.ingestion.weather import WeatherExtractor
from src.loaders.duckdb_loader import DuckDBLoader
from src.utils.logger import get_logger

logger = get_logger("scheduler")


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def try_load(entity: str, parquet_path: str | None = None) -> None:
    """Attempt to load into DuckDB. Non-fatal if locked."""
    try:
        DuckDBLoader().load_parquet(entity, parquet_path=parquet_path)
    except Exception as e:
        if "lock" in str(e).lower():
            logger.warning("db_locked_skipping_load", entity=entity)
        else:
            logger.error("load_failed", entity=entity, error=str(e))


def run_dimensions():
    """Extract and load dimension tables (daily)."""
    logger.info("running_dimensions")

    for ExtractorClass in [RoutesExtractor, StopsExtractor, TripsExtractor, SchedulesExtractor]:
        try:
            with ExtractorClass() as extractor:
                path = extractor.run()
                try_load(extractor.entity_name, path)
        except Exception as e:
            logger.error("dimension_failed", entity=ExtractorClass.__name__, error=str(e))

    try:
        with WeatherExtractor() as extractor:
            path = extractor.run()
        try_load("weather", path)
    except Exception as e:
        logger.error("weather_failed", error=str(e))

    logger.info("dimensions_complete")


def run_predictions():
    """Extract predictions (every 5 min)."""
    try:
        with PredictionsExtractor() as extractor:
            path = extractor.run()
        try_load("predictions", path)
        logger.info("predictions_complete", time=now_utc())
    except Exception as e:
        logger.error("predictions_failed", error=str(e))


def run_vehicles():
    """Extract vehicles (every 5 min)."""
    try:
        with VehiclesExtractor() as extractor:
            path = extractor.run()
        try_load("vehicles", path)
        logger.info("vehicles_complete", time=now_utc())
    except Exception as e:
        logger.error("vehicles_failed", error=str(e))


def run_alerts():
    """Extract alerts (every 15 min)."""
    try:
        with AlertsExtractor() as extractor:
            path = extractor.run()
        try_load("alerts", path)
        logger.info("alerts_complete", time=now_utc())
    except Exception as e:
        logger.error("alerts_failed", error=str(e))


def main():
    """Start the scheduler."""
    logger.info("scheduler_starting")

    run_dimensions()

    schedule.every().day.at("06:00").do(run_dimensions)
    schedule.every(5).minutes.do(run_predictions)
    schedule.every(5).minutes.do(run_vehicles)
    schedule.every(15).minutes.do(run_alerts)

    run_predictions()
    run_vehicles()
    run_alerts()

    logger.info("scheduler_running", jobs=len(schedule.get_jobs()))

    while True:
        schedule.run_pending()
        time.sleep(30)


if __name__ == "__main__":
    main()
