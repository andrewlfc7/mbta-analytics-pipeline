"""Schedules extractor -- MBTA planned arrival/departure times (ALL modes)."""

from typing import Any

import polars as pl

from src.ingestion.base import BaseExtractor


class SchedulesExtractor(BaseExtractor):
    """Extract and transform MBTA schedules for all transit modes.

    Default params fetch all rail + ferry routes.
    Bus requires batched calls via extract_for_routes().
    """

    RAIL_AND_FERRY_ROUTES = [
        # Light Rail
        "Green-B", "Green-C", "Green-D", "Green-E", "Mattapan",
        # Heavy Rail
        "Red", "Orange", "Blue",
        # Commuter Rail
        "CR-Fairmount", "CR-Fitchburg", "CR-Worcester", "CR-Franklin",
        "CR-Greenbush", "CR-Haverhill", "CR-Kingston", "CR-Lowell",
        "CR-Middleborough", "CR-Needham", "CR-Newburyport", "CR-Providence",
        "CR-Foxboro",
        # Ferry
        "Boat-F1", "Boat-F3", "Boat-F4", "Boat-F6",
        "Boat-EastBoston", "Boat-Lynn",
    ]

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
        return {"filter[route]": ",".join(self.RAIL_AND_FERRY_ROUTES)}

    def extract_for_routes(self, route_ids: list[str]) -> list[dict[str, Any]]:
        """Extract schedules for a specific set of routes."""
        self.logger.info(
            "extracting_batch",
            entity=self.entity_name,
            route_count=len(route_ids),
            first_route=route_ids[0],
        )

        try:
            response = self.client.get(
                self.endpoint,
                params={"filter[route]": ",".join(route_ids)},
            )
            response.raise_for_status()
            data = response.json()
            records = self._parse_response(data)
            self.logger.info(
                "extracted_batch",
                entity=self.entity_name,
                record_count=len(records),
            )
            return records
        except Exception as e:
            self.logger.warning(
                "batch_extract_error",
                entity=self.entity_name,
                error=str(e),
            )
            raise

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

        return pl.DataFrame(rows, schema=self._empty_frame().schema)

    def _empty_frame(self) -> pl.DataFrame:
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
