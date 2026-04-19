"""Simple scheduler to accumulate data over time."""

import time
from datetime import datetime, timezone

import schedule

from src.ingestion.routes import RoutesExtractor
from src.ingestion.stops import StopsExtractor
from src.ingestion.trips import TripsExtractor
from src.ingestion.schedules import SchedulesExtractor
from src.ingestion.predictions import PredictionsExtractor
from src.ingestion.vehicles import VehiclesExtractor
from src.ingestion.alerts import AlertsExtractor
from src.ingestion.weather import WeatherExtractor
from src.loaders.duckdb_loader import DuckDBLoader
from src.utils.logger import get_logger

logger = get_logger("scheduler")


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def run_dimensions():
    """Extract and load dimension tables (daily)."""
    logger.info("running_dimensions")
    loader = DuckDBLoader()

    for ExtractorClass in [RoutesExtractor, StopsExtractor, TripsExtractor, SchedulesExtractor]:
        try:
            with ExtractorClass() as extractor:
                extractor.run()
            loader.load_parquet(ExtractorClass().entity_name)
        except Exception as e:
            logger.error("dimension_failed", entity=ExtractorClass.__name__, error=str(e))

    try:
        with WeatherExtractor() as extractor:
            extractor.run()
        loader.load_parquet("weather")
    except Exception as e:
        logger.error("weather_failed", error=str(e))

    logger.info("dimensions_complete")


def run_predictions():
    """Extract and load predictions (every 5 min)."""
    try:
        with PredictionsExtractor() as extractor:
            extractor.run()
        DuckDBLoader().load_parquet("predictions")
        logger.info("predictions_loaded", time=now_utc())
    except Exception as e:
        logger.error("predictions_failed", error=str(e))


def run_vehicles():
    """Extract and load vehicles (every 5 min)."""
    try:
        with VehiclesExtractor() as extractor:
            extractor.run()
        DuckDBLoader().load_parquet("vehicles")
        logger.info("vehicles_loaded", time=now_utc())
    except Exception as e:
        logger.error("vehicles_failed", error=str(e))


def run_alerts():
    """Extract and load alerts (every 15 min)."""
    try:
        with AlertsExtractor() as extractor:
            extractor.run()
        DuckDBLoader().load_parquet("alerts")
        logger.info("alerts_loaded", time=now_utc())
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