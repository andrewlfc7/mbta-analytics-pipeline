"""Run all extractors — quick validation that everything works end to end."""

from src.ingestion.alerts import AlertsExtractor
from src.ingestion.predictions import PredictionsExtractor
from src.ingestion.routes import RoutesExtractor
from src.ingestion.schedules import SchedulesExtractor
from src.ingestion.stops import StopsExtractor
from src.ingestion.trips import TripsExtractor
from src.ingestion.vehicles import VehiclesExtractor
from src.ingestion.weather import WeatherExtractor
from src.utils.logger import get_logger

logger = get_logger("run_all")


def main():
    """Run all extractors and report results."""
    extractors = [
        RoutesExtractor(),
        StopsExtractor(),
        TripsExtractor(),
        SchedulesExtractor(),
        PredictionsExtractor(),
        VehiclesExtractor(),
        AlertsExtractor(),
    ]

    results = []

    for extractor in extractors:
        try:
            path = extractor.run()
            results.append((extractor.entity_name, "✓", path))
        except Exception as e:
            results.append((extractor.entity_name, "✗", str(e)))
        finally:
            extractor.close()

    # Weather is separate
    try:
        weather = WeatherExtractor()
        path = weather.run()
        results.append(("weather", "✓", path))
        weather.close()
    except Exception as e:
        results.append(("weather", "✗", str(e)))

    # Report
    print("\n" + "=" * 60)
    print("EXTRACTION RESULTS")
    print("=" * 60)
    for entity, status, detail in results:
        print(f"  {status} {entity:<15} {detail}")
    print("=" * 60)

    failures = [r for r in results if r[1] == "✗"]
    if failures:
        print(f"\n{len(failures)} extraction(s) failed!")
        return 1
    print(f"\nAll {len(results)} extractions succeeded!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
