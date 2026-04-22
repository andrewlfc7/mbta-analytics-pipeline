"""Partitioning utilities for raw layer storage."""

from datetime import datetime
from pathlib import Path


def get_dimension_path(base_path: str, entity: str, dt: datetime | None = None) -> str:
    """Generate partition path for dimension tables (daily).

    Pattern: {base_path}/{entity}/dt=YYYY-MM-DD/{entity}.parquet
    """
    dt = dt or datetime.utcnow()
    date_str = dt.strftime("%Y-%m-%d")
    return str(Path(base_path) / entity / f"dt={date_str}" / f"{entity}.parquet")


def get_fact_path(
    base_path: str, entity: str, dt: datetime | None = None, hour: int | None = None
) -> str:
    """Generate partition path for fact tables (hourly).

    Pattern:
    {base_path}/{entity}/dt=YYYY-MM-DD/hr=HH/extracted_at=YYYYMMDDTHHMMSSZ/{entity}.parquet
    """
    dt = dt or datetime.utcnow()
    hour = hour if hour is not None else dt.hour
    date_str = dt.strftime("%Y-%m-%d")
    extracted_at = dt.strftime("%Y%m%dT%H%M%SZ")
    return str(
        Path(base_path)
        / entity
        / f"dt={date_str}"
        / f"hr={hour:02d}"
        / f"extracted_at={extracted_at}"
        / f"{entity}.parquet"
    )
