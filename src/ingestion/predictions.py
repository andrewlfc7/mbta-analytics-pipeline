"""Predictions extractor — MBTA real-time arrival/departure predictions."""

from datetime import datetime, timezone
from typing import Any

import polars as pl

from src.ingestion.base import BaseExtractor


class PredictionsExtractor(BaseExtractor):
    """Extract and transform MBTA predictions.

    Real-time data — extracted every 5 minutes.
    Requires route filter.
    """

    SUBWAY_ROUTES = ["Red", "Orange", "Blue", "Green-B", "Green-C", "Green-D", "Green-E"]

    @property
    def entity_name(self) -> str:
        return "predictions"

    @property
    def endpoint(self) -> str:
        return "/predictions"

    @property
    def is_dimension(self) -> bool:
        return False

    @property
    def params(self) -> dict[str, Any]:
        return {"filter[route]": ",".join(self.SUBWAY_ROUTES)}


    def to_dataframe(self, records: list[dict[str, Any]]) -> pl.DataFrame:
        """Convert prediction records to typed Polars DataFrame."""
        if not records:
            return self._empty_frame()

        now = datetime.now(timezone.utc).isoformat()

        rows = []
        for r in records:
            rows.append(
                {
                    "prediction_id": r.get("id"),
                    "arrival_time": r.get("arrival_time"),
                    "arrival_uncertainty": r.get("arrival_uncertainty"),
                    "departure_time": r.get("departure_time"),
                    "departure_uncertainty": r.get("departure_uncertainty"),
                    "direction_id": r.get("direction_id"),
                    "stop_sequence": r.get("stop_sequence"),
                    "schedule_relationship": r.get("schedule_relationship"),
                    "status": str(r.get("status")) if r.get("status") is not None else None,
                    "revenue": r.get("revenue"),
                    "last_trip": r.get("last_trip"),
                    "update_type": r.get("update_type"),
                    "route_id": r.get("route_id"),
                    "stop_id": r.get("stop_id"),
                    "trip_id": r.get("trip_id"),
                    "vehicle_id": r.get("vehicle_id"),
                    "extracted_at": now,
                }
            )

        return pl.DataFrame(rows, schema=self._empty_frame().schema)

    def _empty_frame(self) -> pl.DataFrame:
        """Return empty DataFrame with correct schema."""
        return pl.DataFrame(
            schema={
                "prediction_id": pl.Utf8,
                "arrival_time": pl.Utf8,
                "arrival_uncertainty": pl.Int32,
                "departure_time": pl.Utf8,
                "departure_uncertainty": pl.Int32,
                "direction_id": pl.Int32,
                "stop_sequence": pl.Int32,
                "schedule_relationship": pl.Utf8,
                "status": pl.Utf8,
                "revenue": pl.Utf8,
                "last_trip": pl.Boolean,
                "update_type": pl.Utf8,
                "route_id": pl.Utf8,
                "stop_id": pl.Utf8,
                "trip_id": pl.Utf8,
                "vehicle_id": pl.Utf8,
                "extracted_at": pl.Utf8,
            }
        )
