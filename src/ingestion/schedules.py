"""Schedules extractor -- MBTA planned arrival/departure times."""

import time
from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import polars as pl

from src.ingestion.base import BaseExtractor

NY_TZ = ZoneInfo("America/New_York")
SERVICE_DAY_CUTOFF_HOUR = 3


class SchedulesExtractor(BaseExtractor):
    """Extract and transform MBTA schedules.

    Important: MBTA schedules only support one filter[date] per request.
    Do not send comma-separated dates. We loop through dates one by one.
    """

    RAIL_AND_FERRY_ROUTES = [
        # Light Rail
        "Green-B",
        "Green-C",
        "Green-D",
        "Green-E",
        "Mattapan",
        # Heavy Rail
        "Red",
        "Orange",
        "Blue",
        # Commuter Rail
        "CR-Fairmount",
        "CR-Fitchburg",
        "CR-Worcester",
        "CR-Franklin",
        "CR-Greenbush",
        "CR-Haverhill",
        "CR-Kingston",
        "CR-Lowell",
        "CR-Middleborough",
        "CR-Needham",
        "CR-Newburyport",
        "CR-Providence",
        "CR-Foxboro",
        "CR-NewBedford",
        # Ferry
        "Boat-F1",
        "Boat-F3",
        "Boat-F4",
        "Boat-F6",
        "Boat-EastBoston",
        "Boat-Lynn",
    ]

    def __init__(self, *args, schedule_days: int = 14, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.schedule_days = schedule_days

    @property
    def entity_name(self) -> str:
        return "schedules"

    @property
    def endpoint(self) -> str:
        return "/schedules"

    @property
    def is_dimension(self) -> bool:
        # Schedules are planned facts, not static dimensions.
        return False

    def _current_mbta_service_date(self) -> date:
        """Return current MBTA service date using 3 AM cutoff."""
        now = datetime.now(NY_TZ)

        if now.hour < SERVICE_DAY_CUTOFF_HOUR:
            now = now - timedelta(days=1)

        return now.date()

    def _date_range(self) -> list[str]:
        """Return service dates to fetch, starting from MBTA service day."""
        start = self._current_mbta_service_date()
        return [
            (start + timedelta(days=i)).isoformat()
            for i in range(self.schedule_days)
        ]

    @property
    def params(self) -> dict[str, Any]:
        """Default single-date params.

        BaseExtractor expects params to exist, but this extractor overrides
        extract() because MBTA does not accept comma-separated filter[date].
        """
        return {
            "filter[route]": ",".join(self.RAIL_AND_FERRY_ROUTES),
            "filter[date]": self._date_range()[0],
        }

    def _get_with_retries(
        self,
        params: dict[str, Any],
        max_attempts: int = 5,
        base_sleep_seconds: float = 2.0,
    ):
        """GET MBTA schedules with retry/backoff for transient API failures."""
        last_error: Exception | None = None

        for attempt in range(1, max_attempts + 1):
            try:
                response = self.client.get(self.endpoint, params=params)
                response.raise_for_status()
                return response
            except Exception as exc:
                last_error = exc

                status_code = getattr(getattr(exc, "response", None), "status_code", None)
                retryable = status_code in {429, 500, 502, 503, 504} or status_code is None

                if not retryable or attempt == max_attempts:
                    self.logger.error(
                        "schedule_request_failed",
                        attempt=attempt,
                        max_attempts=max_attempts,
                        status_code=status_code,
                        params=params,
                        error=str(exc),
                    )
                    raise

                sleep_seconds = base_sleep_seconds * attempt
                self.logger.warning(
                    "schedule_request_retry",
                    attempt=attempt,
                    max_attempts=max_attempts,
                    status_code=status_code,
                    sleep_seconds=sleep_seconds,
                    params=params,
                    error=str(exc),
                )
                time.sleep(sleep_seconds)

        raise last_error  # should not be reached

    def extract(self) -> list[dict[str, Any]]:
        """Extract rail/ferry schedules across configured service dates."""
        all_records: list[dict[str, Any]] = []

        for service_date in self._date_range():
            self.logger.info(
                "extracting_schedules_for_date",
                entity=self.entity_name,
                route_count=len(self.RAIL_AND_FERRY_ROUTES),
                service_date=service_date,
            )

            response = self._get_with_retries(
                params={
                    "filter[route]": ",".join(self.RAIL_AND_FERRY_ROUTES),
                    "filter[date]": service_date,
                }
            )

            data = response.json()
            records = self._parse_response(data)
            all_records.extend(records)

            self.logger.info(
                "extracted_schedules_for_date",
                entity=self.entity_name,
                service_date=service_date,
                record_count=len(records),
                total_record_count=len(all_records),
            )

        return all_records

    def extract_for_routes(
        self,
        route_ids: list[str],
        service_dates: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Extract schedules for a specific set of routes across service dates."""
        dates = service_dates or self._date_range()
        all_records: list[dict[str, Any]] = []

        for service_date in dates:
            self.logger.info(
                "extracting_schedule_batch",
                entity=self.entity_name,
                route_count=len(route_ids),
                first_route=route_ids[0] if route_ids else None,
                service_date=service_date,
            )

            try:
                response = self._get_with_retries(
                    params={
                        "filter[route]": ",".join(route_ids),
                        "filter[date]": service_date,
                    }
                )

                data = response.json()
                records = self._parse_response(data)
                all_records.extend(records)

                self.logger.info(
                    "extracted_schedule_batch",
                    entity=self.entity_name,
                    service_date=service_date,
                    record_count=len(records),
                    total_record_count=len(all_records),
                )
            except Exception as e:
                self.logger.warning(
                    "schedule_batch_extract_error",
                    entity=self.entity_name,
                    service_date=service_date,
                    route_count=len(route_ids),
                    error=str(e),
                )
                raise

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
