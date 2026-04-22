"""Trips extractor — MBTA individual trip instances on routes."""

from typing import Any

import polars as pl

from src.ingestion.base import BaseExtractor


class TripsExtractor(BaseExtractor):
    """Extract and transform MBTA trips.

    Note: /trips requires a route filter — we extract per-route
    and combine. Default pulls all subway routes.
    """

    SUBWAY_ROUTES = ["Red", "Orange", "Blue", "Green-B", "Green-C", "Green-D", "Green-E"]

    @property
    def entity_name(self) -> str:
        return "trips"

    @property
    def endpoint(self) -> str:
        return "/trips"

    @property
    def is_dimension(self) -> bool:
        return True

    @property
    def params(self) -> dict[str, Any]:
        return {"filter[route]": ",".join(self.SUBWAY_ROUTES)}

    def to_dataframe(self, records: list[dict[str, Any]]) -> pl.DataFrame:
        """Convert trip records to typed Polars DataFrame."""
        if not records:
            return self._empty_frame()

        rows = []
        for r in records:
            rows.append(
                {
                    "trip_id": r.get("id"),
                    "headsign": r.get("headsign"),
                    "name": r.get("name") or None,
                    "direction_id": r.get("direction_id"),
                    "block_id": r.get("block_id"),
                    "bikes_allowed": r.get("bikes_allowed"),
                    "wheelchair_accessible": r.get("wheelchair_accessible"),
                    "revenue": r.get("revenue"),
                    "route_id": r.get("route_id"),
                    "route_pattern_id": r.get("route_pattern_id"),
                    "service_id": r.get("service_id"),
                    "shape_id": r.get("shape_id"),
                }
            )
        return pl.DataFrame(rows, schema=self._empty_frame().schema)


    def _empty_frame(self) -> pl.DataFrame:
        """Return empty DataFrame with correct schema."""
        return pl.DataFrame(
            schema={
                "trip_id": pl.Utf8,
                "headsign": pl.Utf8,
                "name": pl.Utf8,
                "direction_id": pl.Int32,
                "block_id": pl.Utf8,
                "bikes_allowed": pl.Int32,
                "wheelchair_accessible": pl.Int32,
                "revenue": pl.Utf8,
                "route_id": pl.Utf8,
                "route_pattern_id": pl.Utf8,
                "service_id": pl.Utf8,
                "shape_id": pl.Utf8,
            }
        )
