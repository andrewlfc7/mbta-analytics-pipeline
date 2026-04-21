from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    # API
    api_title: str = "MBTA Analytics API"
    api_version: str = "1.0.0"
    api_prefix: str = "/api/v1"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    debug: bool = False

    # GCP / BigQuery
    gcp_project_id: str = ""
    bigquery_dataset: str = "mbta_analytics"
    google_application_credentials: str = ""

    # Cache
    cache_ttl_seconds: int = 300  # 5 minutes
    cache_dir: str = "/tmp/mbta_api_cache"

    # ML Model
    model_path: str = "ml/models/delay_predictor.joblib"

    # CORS (for frontend)
    cors_origins: list[str] = [
        "http://localhost:3000",          # local next.js dev
        "https://mbta-analytics.vercel.app",  # production
    ]

    class Config:
        env_file = ".env"
        env_prefix = "MBTA_API_"


@lru_cache()
def get_settings() -> Settings:
    return Settings()