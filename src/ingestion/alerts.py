"""Alerts extractor — MBTA service alerts and disruptions.

Alerts are structurally different from other entities:
- No relationships block — uses informed_entity in attributes instead
- informed_entity is a nested list of affected routes/stops
- active_period is a nested list of time windows
"""

from datetime import datetime
from typing import Any

import polars as pl

from src.ingestion.base import BaseExtractor


class AlertsExtractor(BaseExtractor):
    """Extract and transform MBTA alerts.

    Produces two outputs:
    - Main alerts table (one row per alert)
    - Informed entities table (one row per alert × affected entity)
    """

    @property
    def entity_name(self) -> str:
        return "alerts"

    @property
    def endpoint(self) -> str:
        return "/alerts"

    @property
    def is_dimension(self) -> bool:
        return False

    def _parse_response(self, response: dict[str, Any]) -> list[dict[str, Any]]:
        """Override parsing — alerts don't follow standard relationship pattern."""
        records = []
        for item in response.get("data", []):
            record: dict[str, Any] = {
                "id": item.get("id"),
                "type": item.get("type"),
            }

            attributes = item.get("attributes", {})
            for key, value in attributes.items():
                record[key] = value

            records.append(record)

        return records

    def to_dataframe(self, records: list[dict[str, Any]]) -> pl.DataFrame:
        """Convert alert records to typed Polars DataFrame.

        Flattens active_period to first start/end.
        Extracts affected route/stop IDs from informed_entity.
        """
        if not records:
            return self._empty_frame()

        now = datetime.utcnow().isoformat()
        rows = []
        for r in records:
            # Flatten active_period — take first window
            active_periods = r.get("active_period", []) or []
            active_start = None
            active_end = None
            if active_periods:
                active_start = active_periods[0].get("start")
                active_end = active_periods[0].get("end")

            # Extract unique affected routes and stops from informed_entity
            informed = r.get("informed_entity", []) or []
            affected_routes = list(
                {e.get("route") for e in informed if e.get("route")}
            )
            affected_stops = list(
                {e.get("stop") for e in informed if e.get("stop")}
            )

            rows.append(
                {
                    "alert_id": r.get("id"),
                    "cause": r.get("cause"),
                    "effect": r.get("effect"),
                    "severity": r.get("severity"),
                    "lifecycle": r.get("lifecycle"),
                    "header": r.get("header"),
                    "description": r.get("description"),
                    "short_header": r.get("short_header") or None,
                    "service_effect": r.get("service_effect"),
                    "duration_certainty": r.get("duration_certainty"),
                    "active_start": active_start,
                    "active_end": active_end,
                    "created_at": r.get("created_at"),
                    "updated_at": r.get("updated_at"),
                    "closed_timestamp": r.get("closed_timestamp"),
                    "url": r.get("url"),
                    "affected_routes": affected_routes,
                    "affected_stops": affected_stops,
                    "informed_entity_count": len(informed),
                    "extracted_at": now,
                }
            )

        return pl.DataFrame(rows).cast(
            {
                "alert_id": pl.Utf8,
                "cause": pl.Utf8,
                "effect": pl.Utf8,
                "severity": pl.Int32,
                "lifecycle": pl.Utf8,
                "header": pl.Utf8,
                "description": pl.Utf8,
                "short_header": pl.Utf8,
                "service_effect": pl.Utf8,
                "duration_certainty": pl.Utf8,
                "active_start": pl.Utf8,
                "active_end": pl.Utf8,
                "created_at": pl.Utf8,
                "updated_at": pl.Utf8,
                "closed_timestamp": pl.Utf8,
                "url": pl.Utf8,
                "informed_entity_count": pl.Int32,
                "extracted_at": pl.Utf8,
            }
        )

    def _empty_frame(self) -> pl.DataFrame:
        """Return empty DataFrame with correct schema."""
        return pl.DataFrame(
            schema={
                "alert_id": pl.Utf8,
                "cause": pl.Utf8,
                "effect": pl.Utf8,
                "severity": pl.Int32,
                "lifecycle": pl.Utf8,
                "header": pl.Utf8,
                "description": pl.Utf8,
                "short_header": pl.Utf8,
                "service_effect": pl.Utf8,
                "duration_certainty": pl.Utf8,
                "active_start": pl.Utf8,
                "active_end": pl.Utf8,
                "created_at": pl.Utf8,
                "updated_at": pl.Utf8,
                "closed_timestamp": pl.Utf8,
                "url": pl.Utf8,
                "affected_routes": pl.List(pl.Utf8),
                "affected_stops": pl.List(pl.Utf8),
                "informed_entity_count": pl.Int32,
                "extracted_at": pl.Utf8,
            }
        )