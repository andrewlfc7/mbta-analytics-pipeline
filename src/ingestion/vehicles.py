"""Vehicles extractor — MBTA real-time vehicle positions and occupancy."""

from datetime import UTC, datetime
from typing import Any

import polars as pl

from src.ingestion.base import BaseExtractor


class VehiclesExtractor(BaseExtractor):
    """Extract and transform MBTA vehicle positions.

    Real-time data — extracted every 5 minutes.
    Carriages occupancy data is flattened to avg occupancy.
    """

    SUBWAY_ROUTES = ["Red", "Orange", "Blue", "Green-B", "Green-C", "Green-D", "Green-E"]

    @property
    def entity_name(self) -> str:
        return "vehicles"

    @property
    def endpoint(self) -> str:
        return "/vehicles"

    @property
    def is_dimension(self) -> bool:
        return False

    @property
    def params(self) -> dict[str, Any]:
        return {"filter[route]": ",".join(self.SUBWAY_ROUTES)}

    def to_dataframe(self, records: list[dict[str, Any]]) -> pl.DataFrame:
        """Convert vehicle records to typed Polars DataFrame."""
        if not records:
            return self._empty_frame()

        now = datetime.now(UTC).isoformat()

        rows = []
        for r in records:
            # Compute average occupancy from carriages
            carriages = r.get("carriages", []) or []
            carriage_count = len(carriages)
            avg_occupancy_pct = None
            if carriage_count > 0:
                pcts = [
                    c.get("occupancy_percentage")
                    for c in carriages
                    if c.get("occupancy_percentage") is not None
                ]
                if pcts:
                    avg_occupancy_pct = round(sum(pcts) / len(pcts), 2)

            rows.append(
                {
                    "vehicle_id": r.get("id"),
                    "label": r.get("label"),
                    "latitude": r.get("latitude"),
                    "longitude": r.get("longitude"),
                    "bearing": r.get("bearing"),
                    "speed": r.get("speed"),
                    "current_status": r.get("current_status"),
                    "current_stop_sequence": r.get("current_stop_sequence"),
                    "direction_id": r.get("direction_id"),
                    "occupancy_status": r.get("occupancy_status"),
                    "carriage_count": carriage_count,
                    "avg_occupancy_pct": avg_occupancy_pct,
                    "revenue": r.get("revenue"),
                    "updated_at": r.get("updated_at"),
                    "route_id": r.get("route_id"),
                    "stop_id": r.get("stop_id"),
                    "trip_id": r.get("trip_id"),
                    "extracted_at": now,
                }
            )

        return pl.DataFrame(rows).cast(
            {
                "vehicle_id": pl.Utf8,
                "label": pl.Utf8,
                "latitude": pl.Float64,
                "longitude": pl.Float64,
                "bearing": pl.Int32,
                "speed": pl.Float64,
                "current_status": pl.Utf8,
                "current_stop_sequence": pl.Int32,
                "direction_id": pl.Int32,
                "occupancy_status": pl.Utf8,
                "carriage_count": pl.Int32,
                "avg_occupancy_pct": pl.Float64,
                "revenue": pl.Utf8,
                "updated_at": pl.Utf8,
                "route_id": pl.Utf8,
                "stop_id": pl.Utf8,
                "trip_id": pl.Utf8,
                "extracted_at": pl.Utf8,
            }
        )

    def _empty_frame(self) -> pl.DataFrame:
        """Return empty DataFrame with correct schema."""
        return pl.DataFrame(
            schema={
                "vehicle_id": pl.Utf8,
                "label": pl.Utf8,
                "latitude": pl.Float64,
                "longitude": pl.Float64,
                "bearing": pl.Int32,
                "speed": pl.Float64,
                "current_status": pl.Utf8,
                "current_stop_sequence": pl.Int32,
                "direction_id": pl.Int32,
                "occupancy_status": pl.Utf8,
                "carriage_count": pl.Int32,
                "avg_occupancy_pct": pl.Float64,
                "revenue": pl.Utf8,
                "updated_at": pl.Utf8,
                "route_id": pl.Utf8,
                "stop_id": pl.Utf8,
                "trip_id": pl.Utf8,
                "extracted_at": pl.Utf8,
            }
        )