"""Weather extractor — Open-Meteo hourly weather data for Boston.

Used for enrichment: correlate weather conditions with transit delays.
"""

from datetime import datetime
from typing import Any

import httpx
import polars as pl

from src.config import AppConfig, get_config
from src.utils.logger import get_logger
from src.utils.partitioning import get_dimension_path


class WeatherExtractor:
    """Extract hourly weather data from Open-Meteo API.

    Not a subclass of BaseExtractor — different API structure.
    """

    HOURLY_VARIABLES = [
        "temperature_2m",
        "relative_humidity_2m",
        "precipitation",
        "rain",
        "snowfall",
        "wind_speed_10m",
        "wind_gusts_10m",
        "visibility",
        "weather_code",
    ]

    def __init__(self, config: AppConfig | None = None) -> None:
        self.config = config or get_config()
        self.logger = get_logger(self.__class__.__name__)
        self.client = httpx.Client(timeout=self.config.weather.timeout)

    @property
    def entity_name(self) -> str:
        return "weather"

    def extract(self, date: str | None = None) -> dict[str, Any]:
        """Extract hourly weather for a given date (default: today)."""
        if date is None:
            date = datetime.utcnow().strftime("%Y-%m-%d")

        params = {
            "latitude": self.config.weather.latitude,
            "longitude": self.config.weather.longitude,
            "hourly": ",".join(self.HOURLY_VARIABLES),
            "start_date": date,
            "end_date": date,
            "timezone": "America/New_York",
        }

        self.logger.info("extracting_weather", date=date)
        response = self.client.get(self.config.weather.base_url, params=params)
        response.raise_for_status()
        data = response.json()

        self.logger.info(
            "extracted_weather",
            date=date,
            hours=len(data.get("hourly", {}).get("time", [])),
        )
        return data

    def to_dataframe(self, data: dict[str, Any]) -> pl.DataFrame:
        """Convert Open-Meteo response to typed Polars DataFrame."""
        hourly = data.get("hourly", {})

        if not hourly or not hourly.get("time"):
            return self._empty_frame()

        rows = []
        times = hourly["time"]
        for i, time in enumerate(times):
            row = {"timestamp": time}
            for var in self.HOURLY_VARIABLES:
                values = hourly.get(var, [])
                row[var] = values[i] if i < len(values) else None
            rows.append(row)

        return pl.DataFrame(rows).cast(
            {
                "timestamp": pl.Utf8,
                "temperature_2m": pl.Float64,
                "relative_humidity_2m": pl.Float64,
                "precipitation": pl.Float64,
                "rain": pl.Float64,
                "snowfall": pl.Float64,
                "wind_speed_10m": pl.Float64,
                "wind_gusts_10m": pl.Float64,
                "visibility": pl.Float64,
                "weather_code": pl.Int32,
            }
        )

    def save(self, df: pl.DataFrame, dt: datetime | None = None) -> str:
        """Save weather data as parquet."""
        from pathlib import Path

        dt = dt or datetime.utcnow()
        output_path = get_dimension_path(self.config.raw_path, self.entity_name, dt)

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        df.write_parquet(output_path)
        self.logger.info("saved_weather", path=output_path, rows=len(df))
        return output_path

    def run(self, date: str | None = None) -> str:
        """Full pipeline: extract → transform → save."""
        dt = datetime.utcnow()
        data = self.extract(date)
        df = self.to_dataframe(data)
        return self.save(df, dt)

    def _empty_frame(self) -> pl.DataFrame:
        """Return empty DataFrame with correct schema."""
        return pl.DataFrame(
            schema={
                "timestamp": pl.Utf8,
                "temperature_2m": pl.Float64,
                "relative_humidity_2m": pl.Float64,
                "precipitation": pl.Float64,
                "rain": pl.Float64,
                "snowfall": pl.Float64,
                "wind_speed_10m": pl.Float64,
                "wind_gusts_10m": pl.Float64,
                "visibility": pl.Float64,
                "weather_code": pl.Int32,
            }
        )

    def close(self) -> None:
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
