"""Routes extractor — MBTA transit routes (subway, bus, commuter rail, ferry)."""

from typing import Any

import polars as pl

from src.ingestion.base import BaseExtractor

# Route type mapping per MBTA/GTFS spec
ROUTE_TYPE_MAP = {
    0: "Light Rail",
    1: "Heavy Rail",
    2: "Commuter Rail",
    3: "Bus",
    4: "Ferry",
}


class RoutesExtractor(BaseExtractor):
    """Extract and transform MBTA routes."""

    @property
    def entity_name(self) -> str:
        return "routes"

    @property
    def endpoint(self) -> str:
        return "/routes"

    @property
    def is_dimension(self) -> bool:
        return True

    def to_dataframe(self, records: list[dict[str, Any]]) -> pl.DataFrame:
        """Convert route records to typed Polars DataFrame."""
        if not records:
            return self._empty_frame()

        rows = []
        for r in records:
            rows.append(
                {
                    "route_id": r.get("id"),
                    "long_name": r.get("long_name"),
                    "short_name": r.get("short_name") or None,
                    "description": r.get("description"),
                    "fare_class": r.get("fare_class"),
                    "route_type": r.get("type"),
                    "route_type_desc": ROUTE_TYPE_MAP.get(r.get("type"), "Unknown"),
                    "color": r.get("color"),
                    "text_color": r.get("text_color"),
                    "sort_order": r.get("sort_order"),
                    "direction_names": r.get("direction_names"),
                    "direction_destinations": r.get("direction_destinations"),
                    "listed_route": r.get("listed_route"),
                    "line_id": r.get("line_id"),
                    "agency_id": r.get("agency_id"),
                }
            )

        return pl.DataFrame(rows, schema=self._empty_frame().schema)


    def _empty_frame(self) -> pl.DataFrame:
        """Return empty DataFrame with correct schema."""
        return pl.DataFrame(
            schema={
                "route_id": pl.Utf8,
                "long_name": pl.Utf8,
                "short_name": pl.Utf8,
                "description": pl.Utf8,
                "fare_class": pl.Utf8,
                "route_type": pl.Int32,
                "route_type_desc": pl.Utf8,
                "color": pl.Utf8,
                "text_color": pl.Utf8,
                "sort_order": pl.Int32,
                "direction_names": pl.List(pl.Utf8),
                "direction_destinations": pl.List(pl.Utf8),
                "listed_route": pl.Boolean,
                "line_id": pl.Utf8,
                "agency_id": pl.Utf8,
            }
        )