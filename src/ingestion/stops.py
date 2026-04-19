"""Stops extractor — MBTA stations, platforms, and bus stops."""

from typing import Any

import polars as pl

from src.ingestion.base import BaseExtractor

# Location type per GTFS spec
LOCATION_TYPE_MAP = {
    0: "Stop/Platform",
    1: "Station",
    2: "Entrance/Exit",
    3: "Generic Node",
}

# Vehicle type per GTFS spec
VEHICLE_TYPE_MAP = {
    0: "Light Rail",
    1: "Heavy Rail",
    2: "Commuter Rail",
    3: "Bus",
    4: "Ferry",
}


class StopsExtractor(BaseExtractor):
    """Extract and transform MBTA stops."""

    @property
    def entity_name(self) -> str:
        return "stops"

    @property
    def endpoint(self) -> str:
        return "/stops"

    @property
    def is_dimension(self) -> bool:
        return True

    def to_dataframe(self, records: list[dict[str, Any]]) -> pl.DataFrame:
        """Convert stop records to typed Polars DataFrame."""
        if not records:
            return self._empty_frame()

        rows = []
        for r in records:
            rows.append(
                {
                    "stop_id": r.get("id"),
                    "name": r.get("name"),
                    "description": r.get("description"),
                    "latitude": r.get("latitude"),
                    "longitude": r.get("longitude"),
                    "address": r.get("address"),
                    "municipality": r.get("municipality"),
                    "on_street": r.get("on_street"),
                    "at_street": r.get("at_street"),
                    "location_type": r.get("location_type"),
                    "location_type_desc": LOCATION_TYPE_MAP.get(
                        r.get("location_type"), "Unknown"
                    ),
                    "vehicle_type": r.get("vehicle_type"),
                    "vehicle_type_desc": VEHICLE_TYPE_MAP.get(
                        r.get("vehicle_type"), "Unknown"
                    ) if r.get("vehicle_type") is not None else None,
                    "platform_code": r.get("platform_code"),
                    "platform_name": r.get("platform_name"),
                    "wheelchair_boarding": r.get("wheelchair_boarding"),
                    "parent_station_id": r.get("parent_station_id"),
                    "zone_id": r.get("zone_id"),
                }
            )

        return pl.DataFrame(rows, schema=self._empty_frame().schema)


    def _empty_frame(self) -> pl.DataFrame:
        """Return empty DataFrame with correct schema."""
        return pl.DataFrame(
            schema={
                "stop_id": pl.Utf8,
                "name": pl.Utf8,
                "description": pl.Utf8,
                "latitude": pl.Float64,
                "longitude": pl.Float64,
                "address": pl.Utf8,
                "municipality": pl.Utf8,
                "on_street": pl.Utf8,
                "at_street": pl.Utf8,
                "location_type": pl.Int32,
                "location_type_desc": pl.Utf8,
                "vehicle_type": pl.Int32,
                "vehicle_type_desc": pl.Utf8,
                "platform_code": pl.Utf8,
                "platform_name": pl.Utf8,
                "wheelchair_boarding": pl.Int32,
                "parent_station_id": pl.Utf8,
                "zone_id": pl.Utf8,
            }
        )