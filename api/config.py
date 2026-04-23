from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # API
    api_title: str = "MBTA Analytics API"
    api_version: str = "1.0.0"
    api_prefix: str = "/api/v1"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    debug: bool = False

    # GCP / BigQuery
    gcp_project_id: str = "server-i3"
    google_application_credentials: str = ""

    # Cache — 20 min TTL (data updates hourly via DAGs)
    cache_ttl_seconds: int = 2700
    cache_max_entries: int = 256
    cache_dir: str = "/tmp/mbta_api_cache"

    # ML Model
    model_path: str = "ml/models/delay_predictor.joblib"

    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "https://mbta-analytics.vercel.app",
        "https://mbta-analytics-pipeline.vercel.app",
    ]

    class Config:
        env_file = ".env"
        env_prefix = "MBTA_API_"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
