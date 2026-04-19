"""Environment-aware configuration for local and GCP deployments."""

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class LocalConfig:
    """Local development configuration."""

    raw_path: Path = Path("./data/raw")
    warehouse: str = "duckdb"
    db_path: Path = Path("./data/mbta.duckdb")



@dataclass(frozen=True)
class GCPConfig:
    """GCP production configuration."""

    raw_path: str = "./data/raw"          # ← local staging, NOT gs://
    warehouse: str = "bigquery"
    project_id: str = ""
    dataset: str = "raw_mbta"
    bucket: str = ""

    def __post_init__(self) -> None:
        object.__setattr__(
            self,
            "project_id",
            self.project_id or os.getenv("GCP_PROJECT_ID", "mbta-analytics"),
        )
        object.__setattr__(
            self,
            "bucket",
            self.bucket or os.getenv("GCS_BUCKET", "mbta-raw-prod"),
        )



@dataclass(frozen=True)
class MBTAAPIConfig:
    """MBTA API configuration."""

    base_url: str = "https://api-v3.mbta.com"
    api_key: str | None = field(default=None)
    timeout: int = 30
    max_retries: int = 3
    retry_delay: float = 1.0

    def __post_init__(self) -> None:
        key = self.api_key or os.getenv("MBTA_API_KEY")
        object.__setattr__(self, "api_key", key)

    @property
    def headers(self) -> dict[str, str]:
        if self.api_key:
            return {"x-api-key": self.api_key}
        return {}


@dataclass(frozen=True)
class WeatherAPIConfig:
    """Open-Meteo API configuration."""

    base_url: str = "https://api.open-meteo.com/v1/forecast"
    latitude: float = 42.3601  # Boston
    longitude: float = -71.0589
    timeout: int = 30


@dataclass(frozen=True)
class AppConfig:
    """Top-level application config."""

    env: str = ""
    mbta: MBTAAPIConfig = field(default_factory=MBTAAPIConfig)
    weather: WeatherAPIConfig = field(default_factory=WeatherAPIConfig)
    local: LocalConfig = field(default_factory=LocalConfig)
    gcp: GCPConfig = field(default_factory=GCPConfig)

    def __post_init__(self) -> None:
        env = self.env or os.getenv("MBTA_ENV", "local")
        object.__setattr__(self, "env", env)

    @property
    def is_local(self) -> bool:
        return self.env == "local"

    @property
    def raw_path(self) -> str:
        if self.is_local:
            return str(self.local.raw_path)
        return self.gcp.raw_path

    @property
    def warehouse_type(self) -> str:
        if self.is_local:
            return self.local.warehouse
        return self.gcp.warehouse


def get_config() -> AppConfig:
    """Factory function to get application config."""
    return AppConfig()