"""Schedules extractor — MBTA planned arrival/departure times (ALL modes)."""

from typing import Any

import polars as pl
import logging

from src.ingestion.base import BaseExtractor

logger = logging.getLogger(__name__)


class SchedulesExtractor(BaseExtractor):
    """Extract and transform MBTA schedules for all transit modes.

    Requires route filter. Batches bus routes.
    """

    SUBWAY_ROUTES = [
        "Red", "Orange", "Blue", "Mattapan",
        "Green-B", "Green-C", "Green-D", "Green-E",
    ]

    COMMUTER_RAIL_ROUTES = [
        "CR-Fairmount", "CR-Fitchburg", "CR-Worcester", "CR-Franklin",
        "CR-Greenbush", "CR-Haverhill", "CR-Kingston", "CR-Lowell",
        "CR-Middleborough", "CR-Needham", "CR-Newburyport", "CR-Providence",
        "CR-Foxboro",
    ]

    FERRY_ROUTES = [
        "Boat-F1", "Boat-F3", "Boat-F4", "Boat-F6",
        "Boat-EastBoston", "Boat-Lynn",
    ]

    BUS_BATCH_SIZE = 15  # Schedules returns more rows, keep batches smaller

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

    def get_all_route_batches(self, bus_routes: list[str] | None = None) -> list[list[str]]:
        """Build batched route lists for all modes."""
        batches = []
        batches.append(self.SUBWAY_ROUTES)
        batches.append(self.COMMUTER_RAIL_ROUTES)
        batches.append(self.FERRY_ROUTES)

        if bus_routes:
            for i in range(0, len(bus_routes), self.BUS_BATCH_SIZE):
                batch = bus_routes[i : i + self.BUS_BATCH_SIZE]
                batches.append(batch)

        return batches

    async def extract_all_modes(
        self,
        bus_routes: list[str] | None = None,
    ) -> pl.DataFrame:
        """Extract schedules for ALL transit modes via batched requests."""
        batches = self.get_all_route_batches(bus_routes)
        all_frames = []

        for batch_idx, route_batch in enumerate(batches):
            route_str = ",".join(route_batch)
            logger.info(
                f"Schedules batch {batch_idx + 1}/{len(batches)}: "
                f"{len(route_batch)} routes ({route_batch[0]}...)"
            )

            try:
                self._override_params = {"filter[route]": route_str}
                records = self.fetch()
                df = self.to_dataframe(records)

                if len(df) > 0:
                    all_frames.append(df)
                    logger.info(f"  → {len(df)} schedule entries")
                else:
                    logger.info(f"  → 0 entries")

            except Exception as e:
                logger.warning(f"  → Batch {batch_idx + 1} failed: {e}")
                continue
            finally:
                self._override_params = None

        if all_frames:
            combined = pl.concat(all_frames)
            logger.info(
                f"Total schedule entries extracted: {len(combined)} "
                f"across {len(batches)} batches"
            )
            return combined

        return self._empty_frame()

    def fetch(self) -> list[dict[str, Any]]:
        """Fetch records, using override params if set."""
        params = getattr(self, "_override_params", None) or self.params
        return self._fetch_with_params(params)

    def _fetch_with_params(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        """Fetch from MBTA API with given params."""
        import requests

        url = f"{self.base_url}{self.endpoint}"
        headers = {"x-api-key": self.api_key} if self.api_key else {}

        all_records = []
        page_url = url
        page_params = {**params}

        while page_url:
            response = requests.get(
                page_url, params=page_params, headers=headers, timeout=30
            )
            response.raise_for_status()
            data = response.json()

            for item in data.get("data", []):
                record = {"id": item["id"]}
                record.update(item.get("attributes", {}))

                rels = item.get("relationships", {})
                for rel_name in ["route", "stop", "trip"]:
                    rel_data = rels.get(rel_name, {}).get("data")
                    if rel_data:
                        record[f"{rel_name}_id"] = rel_data.get("id")

                all_records.append(record)

            # Handle pagination
            next_url = data.get("links", {}).get("next")
            if next_url and len(all_records) < 10000:
                page_url = next_url
                page_params = {}  # Next URL already has params
            else:
                break

        return all_records

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