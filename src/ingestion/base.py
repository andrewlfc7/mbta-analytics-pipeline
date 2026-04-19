"""Base extractor class for MBTA API ingestion."""

from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
import polars as pl

from src.config import AppConfig, get_config
from src.utils.logger import get_logger
from src.utils.partitioning import get_dimension_path, get_fact_path


class BaseExtractor(ABC):
    """Base class for all MBTA API extractors."""

    def __init__(self, config: AppConfig | None = None) -> None:
        self.config = config or get_config()
        self.logger = get_logger(self.__class__.__name__)
        self.client = httpx.Client(
            base_url=self.config.mbta.base_url,
            headers=self.config.mbta.headers,
            timeout=self.config.mbta.timeout,
        )

    @property
    @abstractmethod
    def entity_name(self) -> str:
        """Name of the entity (routes, stops, etc.)."""
        ...

    @property
    @abstractmethod
    def endpoint(self) -> str:
        """API endpoint path."""
        ...

    @property
    def is_dimension(self) -> bool:
        """Whether this is a dimension (daily) or fact (hourly) table."""
        return True

    @property
    def params(self) -> dict[str, Any]:
        """Default query parameters for the API request."""
        return {}

    def extract(self) -> list[dict[str, Any]]:
        """Extract raw data from MBTA API with retry logic."""
        self.logger.info("extracting", entity=self.entity_name, endpoint=self.endpoint)

        for attempt in range(1, self.config.mbta.max_retries + 1):
            try:
                response = self.client.get(self.endpoint, params=self.params)
                response.raise_for_status()
                data = response.json()
                records = self._parse_response(data)
                self.logger.info(
                    "extracted",
                    entity=self.entity_name,
                    record_count=len(records),
                    attempt=attempt,
                )
                return records

            except httpx.HTTPStatusError as e:
                self.logger.warning(
                    "http_error",
                    entity=self.entity_name,
                    status_code=e.response.status_code,
                    attempt=attempt,
                )
                if attempt == self.config.mbta.max_retries:
                    raise
            except httpx.RequestError as e:
                self.logger.warning(
                    "request_error",
                    entity=self.entity_name,
                    error=str(e),
                    attempt=attempt,
                )
                if attempt == self.config.mbta.max_retries:
                    raise

        return []

    def _parse_response(self, response: dict[str, Any]) -> list[dict[str, Any]]:
        """Parse MBTA JSON:API response into flat records.

        MBTA API returns data in JSON:API format:
        {
            "data": [
                {
                    "id": "...",
                    "type": "...",
                    "attributes": { ... },
                    "relationships": { ... }
                }
            ]
        }
        """
        records = []
        for item in response.get("data", []):
            record: dict[str, Any] = {
                "id": item.get("id"),
                "type": item.get("type"),
            }

            # Flatten attributes
            attributes = item.get("attributes", {})
            for key, value in attributes.items():
                record[key] = value

            # Flatten relationship IDs
            relationships = item.get("relationships", {})
            for rel_name, rel_data in relationships.items():
                rel_inner = rel_data.get("data")
                if isinstance(rel_inner, dict):
                    record[f"{rel_name}_id"] = rel_inner.get("id")
                elif isinstance(rel_inner, list):
                    record[f"{rel_name}_ids"] = [r.get("id") for r in rel_inner]

            records.append(record)

        return records

    @abstractmethod
    def to_dataframe(self, records: list[dict[str, Any]]) -> pl.DataFrame:
        """Convert raw records to a typed Polars DataFrame."""
        ...

    def get_output_path(self, dt: datetime | None = None) -> str:
        """Get partitioned output path for this entity."""
        raw_path = self.config.raw_path
        if self.is_dimension:
            return get_dimension_path(raw_path, self.entity_name, dt)
        return get_fact_path(raw_path, self.entity_name, dt)

    def save(self, df: pl.DataFrame, dt: datetime | None = None) -> str:
        """Save DataFrame as parquet to the appropriate path."""
        output_path = self.get_output_path(dt)

        # Create directories for local storage
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        df.write_parquet(output_path)
        self.logger.info(
            "saved",
            entity=self.entity_name,
            path=output_path,
            rows=len(df),
        )
        return output_path

    def run(self, dt: datetime | None = None) -> str:
        """Full extraction pipeline: extract → transform → save."""
        records = self.extract()
        df = self.to_dataframe(records)
        return self.save(df, dt)

    def close(self) -> None:
        """Close the HTTP client."""
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
