"""Predictions extractor -- MBTA real-time arrival/departure predictions (ALL modes)."""

from datetime import datetime, timezone
from typing import Any

import polars as pl

from src.ingestion.base import BaseExtractor


class PredictionsExtractor(BaseExtractor):
    """Extract and transform MBTA predictions for all transit modes.

    Default params fetch all rail + ferry routes (27 routes).
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
        return "predictions"

    @property
    def endpoint(self) -> str:
        return "/predictions"

    @property
    def is_dimension(self) -> bool:
        return False

    @property
    def params(self) -> dict[str, Any]:
        return {"filter[route]": ",".join(self.RAIL_AND_FERRY_ROUTES)}


    def extract_for_routes(self, route_ids: list[str]) -> list[dict[str, Any]]:
        """Extract predictions for a specific set of routes.

        Temporarily overrides the default params for one API call.
        Used for bus route batching.
        """
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
                    "status": (
                        str(r.get("status"))
                        if r.get("status") is not None
                        else None
                    ),
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
