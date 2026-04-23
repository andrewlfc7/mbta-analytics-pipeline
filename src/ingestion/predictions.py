"""Predictions extractor — MBTA real-time arrival/departure predictions (ALL modes)."""

from datetime import datetime, timezone
from typing import Any

import polars as pl
import logging

from src.ingestion.base import BaseExtractor

logger = logging.getLogger(__name__)


class PredictionsExtractor(BaseExtractor):
    """Extract and transform MBTA predictions for all transit modes.

    Real-time data — extracted every 5 minutes.
    Batches requests to avoid API limits on filter[route].
    """

    # Subway (Light Rail + Heavy Rail)
    SUBWAY_ROUTES = [
        "Red", "Orange", "Blue", "Mattapan",
        "Green-B", "Green-C", "Green-D", "Green-E",
    ]

    # Commuter Rail
    COMMUTER_RAIL_ROUTES = [
        "CR-Fairmount", "CR-Fitchburg", "CR-Worcester", "CR-Franklin",
        "CR-Greenbush", "CR-Haverhill", "CR-Kingston", "CR-Lowell",
        "CR-Middleborough", "CR-Needham", "CR-Newburyport", "CR-Providence",
        "CR-Foxboro",
    ]

    # Ferry
    FERRY_ROUTES = [
        "Boat-F1", "Boat-F3", "Boat-F4", "Boat-F6",
        "Boat-EastBoston", "Boat-Lynn",
    ]

    # Bus — too many for one request, we fetch dynamically
    # MBTA API allows ~20 routes per request reliably
    BUS_BATCH_SIZE = 20

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
        # Default params (used if extract() is called directly)
        return {"filter[route]": ",".join(self.SUBWAY_ROUTES)}

    def get_all_route_batches(self, bus_routes: list[str] | None = None) -> list[list[str]]:
        """Build batched route lists for all modes.

        Args:
            bus_routes: List of bus route IDs. If None, skips bus.
                        Pass from RoutesExtractor or BigQuery lookup.
        """
        batches = []

        # Subway — all in one batch (8 routes)
        batches.append(self.SUBWAY_ROUTES)

        # Commuter Rail — all in one batch (13 routes)
        batches.append(self.COMMUTER_RAIL_ROUTES)

        # Ferry — all in one batch (6 routes)
        batches.append(self.FERRY_ROUTES)

        # Bus — split into batches of BUS_BATCH_SIZE
        if bus_routes:
            for i in range(0, len(bus_routes), self.BUS_BATCH_SIZE):
                batch = bus_routes[i : i + self.BUS_BATCH_SIZE]
                batches.append(batch)

        return batches

    async def extract_all_modes(
        self,
        bus_routes: list[str] | None = None,
    ) -> pl.DataFrame:
        """Extract predictions for ALL transit modes via batched requests.

        Usage in DAG or runner:
            extractor = PredictionsExtractor(api_key=key)
            # Get bus routes from BigQuery or routes extractor
            bus_routes = [...list of bus route IDs...]
            df = await extractor.extract_all_modes(bus_routes=bus_routes)
        """
        batches = self.get_all_route_batches(bus_routes)
        all_frames = []

        for batch_idx, route_batch in enumerate(batches):
            route_str = ",".join(route_batch)
            logger.info(
                f"Predictions batch {batch_idx + 1}/{len(batches)}: "
                f"{len(route_batch)} routes ({route_batch[0]}...)"
            )

            try:
                # Override params for this batch
                self._override_params = {"filter[route]": route_str}
                records = self.fetch()
                df = self.to_dataframe(records)

                if len(df) > 0:
                    all_frames.append(df)
                    logger.info(f"  → {len(df)} predictions")
                else:
                    logger.info(f"  → 0 predictions (no active service)")

            except Exception as e:
                logger.warning(
                    f"  → Batch {batch_idx + 1} failed: {e}"
                )
                continue
            finally:
                self._override_params = None

        if all_frames:
            combined = pl.concat(all_frames)
            logger.info(
                f"Total predictions extracted: {len(combined)} "
                f"across {len(batches)} batches"
            )
            return combined

        return self._empty_frame()

    def fetch(self) -> list[dict[str, Any]]:
        """Fetch records, using override params if set."""
        params = getattr(self, "_override_params", None) or self.params
        # Call parent's fetch logic with overridden params
        return self._fetch_with_params(params)

    def _fetch_with_params(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        """Fetch from MBTA API with given params."""
        import requests

        url = f"{self.base_url}{self.endpoint}"
        headers = {"x-api-key": self.api_key} if self.api_key else {}

        response = requests.get(url, params=params, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()

        records = []
        included = {
            item["id"]: item
            for item in data.get("included", [])
        }

        for item in data.get("data", []):
            record = {"id": item["id"]}
            record.update(item.get("attributes", {}))

            # Extract relationships
            rels = item.get("relationships", {})
            for rel_name in ["route", "stop", "trip", "vehicle"]:
                rel_data = rels.get(rel_name, {}).get("data")
                if rel_data:
                    record[f"{rel_name}_id"] = rel_data.get("id")

            records.append(record)

        return records

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