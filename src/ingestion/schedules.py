"""Schedules extractor — MBTA planned arrival/departure times."""

from typing import Any

import polars as pl

from src.ingestion.base import BaseExtractor


class SchedulesExtractor(BaseExtractor):
    """Extract and transform MBTA schedules.

    Requires route filter. Default pulls subway routes.
    """

    SUBWAY_ROUTES = ["Red", "Orange", "Blue", "Green-B", "Green-C", "Green-D", "Green-E"]

    @property
    def entity_name(self) -> str:
        return "schedules"

    @property
    def endpoint(self) -> str:
        return "/schedules"

    @property
    def is_dimension(self) -> bool:
        return True

    @property
    def params(self) -> dict[str, Any]:
        return {"filter[route]": ",".join(self.SUBWAY_ROUTES)}

    def to_dataframe(self, records: list[dict[str, Any]]) -> pl.DataFrame:
        """Convert schedule records to typed Polars DataFrame."""
        if not records:
            return self._empty_frame()

        rows = []
        for r in records:
            rows.append(
                {
                    "schedule_id": r.get("id"),
                    "arrival_time": r.get("arrival_time"),
                    "departure_time": r.get("departure_time"),
                    "direction_id": r.get("direction_id"),
                    "stop_sequence": r.get("stop_sequence"),
                    "stop_headsign": r.get("stop_headsign"),
                    "pickup_type": r.get("pickup_type"),
                    "drop_off_type": r.get("drop_off_type"),
                    "timepoint": r.get("timepoint"),
                    "route_id": r.get("route_id"),
                    "stop_id": r.get("stop_id"),
                    "trip_id": r.get("trip_id"),
                }
            )

        return pl.DataFrame(rows).cast(
            {
                "schedule_id": pl.Utf8,
                "arrival_time": pl.Utf8,
                "departure_time": pl.Utf8,
                "direction_id": pl.Int32,
                "stop_sequence": pl.Int32,
                "stop_headsign": pl.Utf8,
                "pickup_type": pl.Int32,
                "drop_off_type": pl.Int32,
                "timepoint": pl.Boolean,
                "route_id": pl.Utf8,
                "stop_id": pl.Utf8,
                "trip_id": pl.Utf8,
            }
        )

    def _empty_frame(self) -> pl.DataFrame:
        """Return empty DataFrame with correct schema."""
        return pl.DataFrame(
            schema={
                "schedule_id": pl.Utf8,
                "arrival_time": pl.Utf8,
                "departure_time": pl.Utf8,
                "direction_id": pl.Int32,
                "stop_sequence": pl.Int32,
                "stop_headsign": pl.Utf8,
                "pickup_type": pl.Int32,
                "drop_off_type": pl.Int32,
                "timepoint": pl.Boolean,
                "route_id": pl.Utf8,
                "stop_id": pl.Utf8,
                "trip_id": pl.Utf8,
            }
        )