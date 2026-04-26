import asyncio
import contextvars
import hashlib
import json
import logging
import os
import time
from collections import OrderedDict
from pathlib import Path
from typing import Any

from google.api_core.exceptions import GoogleAPIError
from google.cloud import bigquery
from google.oauth2 import service_account

from api.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
request_cache_context: contextvars.ContextVar[dict[str, int] | None] = (
    contextvars.ContextVar("request_cache_context", default=None)
)


class BigQueryService:
    def __init__(self, project_id: str):
        self.project_id = project_id
        self._client = None
        self.cache: OrderedDict[str, dict[str, Any]] = OrderedDict()
        self.payload_cache: OrderedDict[str, dict[str, Any]] = OrderedDict()
        self.cache_dir = Path(settings.cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache_stats = {
            "hits": 0,
            "misses": 0,
            "errors": 0,
            "coalesced": 0,
        }
        self._in_flight: dict[str, asyncio.Future[list[dict]]] = {}
        self._in_flight_lock = asyncio.Lock()

    def begin_request_tracking(self):
        return request_cache_context.set(
            {
                "hits": 0,
                "misses": 0,
                "coalesced": 0,
                "stale": 0,
            }
        )

    def get_request_cache_info(self) -> dict[str, int]:
        return request_cache_context.get() or {
            "hits": 0,
            "misses": 0,
            "coalesced": 0,
            "stale": 0,
        }

    def end_request_tracking(self, token):
        request_cache_context.reset(token)

    def _track_request_cache(self, key: str):
        current = request_cache_context.get()
        if current is None:
            return
        current[key] = current.get(key, 0) + 1

    @property
    def client(self):
        """Lazy-load BigQuery client using service account key."""
        if self._client is None:
            key_path = settings.google_application_credentials
            if key_path and os.path.exists(key_path):
                credentials = service_account.Credentials.from_service_account_file(
                    key_path,
                    scopes=["https://www.googleapis.com/auth/bigquery"],
                )
                self._client = bigquery.Client(
                    project=self.project_id, credentials=credentials
                )
                logger.info(f"BigQuery client created with service account: {key_path}")
            else:
                self._client = bigquery.Client(project=self.project_id)
                logger.info("BigQuery client created with default credentials")
        return self._client

    def _cache_key(self, query: str, params: dict | None = None) -> str:
        content = query + json.dumps(params or {}, sort_keys=True)
        return hashlib.md5(content.encode()).hexdigest()

    def _get_cached(self, key: str, record_stats: bool = True) -> list[dict] | None:
        now = time.time()

        # Check in-memory first
        if key in self.cache:
            entry = self.cache[key]
            if now - entry["timestamp"] < settings.cache_ttl_seconds:
                entry["last_access"] = now
                self.cache.move_to_end(key)
                if record_stats:
                    self.cache_stats["hits"] += 1
                    self._track_request_cache("hits")
                return entry["data"]
            else:
                del self.cache[key]

        # Check file cache
        cache_file = self.cache_dir / f"{key}.json"
        if cache_file.exists():
            stat = cache_file.stat()
            if now - stat.st_mtime < settings.cache_ttl_seconds:
                try:
                    with open(cache_file) as f:
                        data = json.load(f)
                    self.cache[key] = {
                        "data": data,
                        "timestamp": stat.st_mtime,
                        "last_access": now,
                    }
                    self._prune_cache()
                    if record_stats:
                        self.cache_stats["hits"] += 1
                        self._track_request_cache("hits")
                    return data
                except (json.JSONDecodeError, OSError):
                    pass

        if record_stats:
            self.cache_stats["misses"] += 1
        return None

    def _set_cached(self, key: str, data: list[dict]):
        now = time.time()
        self.cache[key] = {
            "data": data,
            "timestamp": now,
            "last_access": now,
        }
        self.cache.move_to_end(key)
        self._prune_cache()
        try:
            cache_file = self.cache_dir / f"{key}.json"
            with open(cache_file, "w") as f:
                json.dump(data, f, default=str)
        except OSError as e:
            logger.warning(f"Failed to write cache file: {e}")

    def _prune_cache(self):
        while len(self.cache) > settings.cache_max_entries:
            self.cache.popitem(last=False)
        while len(self.payload_cache) > settings.cache_max_entries:
            self.payload_cache.popitem(last=False)

    def get_cached_payload(self, key: str, ttl_seconds: int | None = None) -> Any | None:
        now = time.time()
        ttl = ttl_seconds or settings.payload_cache_ttl_seconds
        entry = self.payload_cache.get(key)
        if entry is None:
            return None
        if now - entry["timestamp"] >= ttl:
            self.payload_cache.pop(key, None)
            return None
        entry["last_access"] = now
        self.payload_cache.move_to_end(key)
        return entry["data"]

    def set_cached_payload(self, key: str, data: Any):
        now = time.time()
        self.payload_cache[key] = {
            "data": data,
            "timestamp": now,
            "last_access": now,
        }
        self.payload_cache.move_to_end(key)
        self._prune_cache()

    def _get_stale_cached(self, key: str) -> list[dict] | None:
        entry = self.cache.get(key)
        if entry is not None:
            return entry["data"]

        cache_file = self.cache_dir / f"{key}.json"
        if not cache_file.exists():
            return None

        try:
            with open(cache_file) as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return None

    def invalidate_cache(self):
        """Clear all caches. Call after DAG runs complete."""
        self.cache.clear()
        try:
            for f in self.cache_dir.glob("*.json"):
                f.unlink()
            logger.info("Cache invalidated")
        except OSError as e:
            logger.warning(f"Failed to clear file cache: {e}")

    def get_cache_info(self) -> dict:
        """Return cache statistics for monitoring."""
        total = self.cache_stats["hits"] + self.cache_stats["misses"]
        hit_rate = (
            round(self.cache_stats["hits"] / total * 100, 1) if total > 0 else 0
        )
        return {
            "entries": len(self.cache),
            "payload_entries": len(self.payload_cache),
            "hits": self.cache_stats["hits"],
            "misses": self.cache_stats["misses"],
            "hit_rate_pct": hit_rate,
            "ttl_seconds": settings.cache_ttl_seconds,
            "max_entries": settings.cache_max_entries,
            "errors": self.cache_stats["errors"],
            "coalesced": self.cache_stats["coalesced"],
            "in_flight": len(self._in_flight),
        }

    def _execute_query(self, query: str) -> tuple[list[dict], float, int]:
        start = time.time()
        query_job = self.client.query(query)
        results = query_job.result()
        rows = [dict(row) for row in results]
        elapsed = time.time() - start
        bytes_processed = int(query_job.total_bytes_processed or 0)
        return rows, elapsed, bytes_processed

    async def query(
        self,
        query: str,
        params: dict | None = None,
        use_cache: bool = True,
    ) -> list[dict]:
        cache_key = self._cache_key(query, params)

        if use_cache:
            cached = self._get_cached(cache_key)
            if cached is not None:
                return cached

        future: asyncio.Future[list[dict]] | None = None
        should_execute = True

        if use_cache:
            async with self._in_flight_lock:
                cached = self._get_cached(cache_key, record_stats=False)
                if cached is not None:
                    return cached

                future = self._in_flight.get(cache_key)
                if future is None:
                    future = asyncio.get_running_loop().create_future()
                    self._in_flight[cache_key] = future
                else:
                    should_execute = False

        if not should_execute and future is not None:
            self.cache_stats["coalesced"] += 1
            self._track_request_cache("coalesced")
            return await future

        try:
            logger.info(f"Executing BigQuery query: {cache_key[:8]}...")
            rows, elapsed, bytes_processed = await asyncio.to_thread(
                self._execute_query,
                query,
            )

            if use_cache:
                self._set_cached(cache_key, rows)
                self._track_request_cache("misses")

            logger.info(
                f"Query {cache_key[:8]} returned {len(rows)} rows in {elapsed:.2f}s "
                f"({bytes_processed / 1024:.1f} KB processed)"
            )

            if future is not None and not future.done():
                future.set_result(rows)
            return rows

        except GoogleAPIError as e:
            self.cache_stats["errors"] += 1
            logger.error(f"BigQuery error: {e}")
            # Return stale cache if available
            stale = self._get_stale_cached(cache_key)
            if stale is not None:
                logger.warning(f"Returning stale cache for {cache_key[:8]}")
                self._track_request_cache("stale")
                if future is not None and not future.done():
                    future.set_result(stale)
                return stale
            if future is not None and not future.done():
                future.set_exception(e)
            raise
        except Exception as e:
            self.cache_stats["errors"] += 1
            logger.error(f"Unexpected query error: {e}")
            stale = self._get_stale_cached(cache_key)
            if stale is not None:
                logger.warning(f"Returning stale cache for {cache_key[:8]}")
                self._track_request_cache("stale")
                if future is not None and not future.done():
                    future.set_result(stale)
                return stale
            if future is not None and not future.done():
                future.set_exception(e)
            raise
        finally:
            if use_cache:
                async with self._in_flight_lock:
                    current = self._in_flight.get(cache_key)
                    if current is future:
                        self._in_flight.pop(cache_key, None)

    async def query_from_file(
        self,
        filename: str,
        params: dict | None = None,
        use_cache: bool = True,
    ) -> list[dict]:
        query_path = Path(__file__).parent.parent / "queries" / filename
        query = query_path.read_text()

        query = query.replace("{project}", self.project_id)

        if params:
            for key, value in params.items():
                query = query.replace(f"@{key}", f"{value}")

        return await self.query(query, params=params, use_cache=use_cache)

    async def warm_cache(self):
        """Warm the exact query shapes hit by the main UI."""
        logger.info("Warming cache for hot endpoint queries...")
        warmup_queries = [
            # Overview
            ("overview_system_enhanced.sql", None),
            ("overview_system_prev_week.sql", None),
            ("overview_trips_by_mode.sql", None),
            ("overview_route_ranking_filtered.sql", {"mode": "all", "limit": "5"}),
            ("overview_route_ranking_filtered.sql", {"mode": "all", "limit": "10"}),
            ("overview_route_ranking_filtered.sql", {"mode": "bus", "limit": "5"}),
            ("overview_route_ranking_filtered.sql", {"mode": "subway", "limit": "5"}),
            ("overview_route_ranking_filtered.sql", {"mode": "commuter_rail", "limit": "5"}),
            ("overview_route_ranking_filtered.sql", {"mode": "ferry", "limit": "5"}),
            ("overview_performance_trends.sql", {"day_type": "weekday"}),
            # Alerts
            ("alerts_active.sql", {"severity": "all", "limit": "5"}),
            ("alerts_active.sql", {"severity": "all", "limit": "20"}),
            ("alerts_by_mode.sql", None),
            # Routes
            ("routes_reliability.sql", None),
            ("routes_detail.sql", {"route_id": "Red"}),
            ("routes_detail.sql", {"route_id": "Orange"}),
            ("routes_detail.sql", {"route_id": "Blue"}),
            ("routes_detail.sql", {"route_id": "Green-B"}),
            ("routes_detail.sql", {"route_id": "CR-Providence"}),
            ("routes_hourly.sql", {"route_id": "Red"}),
            ("routes_hourly.sql", {"route_id": "Blue"}),
            ("routes_hourly.sql", {"route_id": "Orange"}),
            ("routes_hourly.sql", {"route_id": "Green-B"}),
            ("routes_hourly.sql", {"route_id": "Green-C"}),
            ("routes_hourly.sql", {"route_id": "Green-D"}),
            ("routes_hourly.sql", {"route_id": "Green-E"}),
            # Delays
            ("heatmap_day_hour.sql", {"route_filter": "all", "direction": "all", "period_days": "30"}),
            ("temporal_day_of_week.sql", {"route_filter": "all", "period_days": "90"}),
            ("temporal_hourly.sql", {"route_filter": "all", "day_type": "all", "period_days": "90"}),
            ("temporal_rush_hour.sql", {"route_filter": "all", "period_days": "90"}),
            ("temporal_delay_probability.sql", {"route_filter": "all", "period_days": "90"}),
            # Stations
            ("stations_performance_filtered.sql", {"sort_by": "delay_hotspot_score", "limit": "50"}),
            ("stations_performance_filtered.sql", {"sort_by": "delay_hotspot_score", "limit": "100"}),
            ("delay_hotspots.sql", {"limit": "5"}),
            ("map_route_lines.sql", None),
            ("map_stations.sql", None),
            # Weather
            ("weather_overview.sql", None),
            ("weather_current.sql", None),
            ("weather_scatter_temp.sql", {"route_filter": "all"}),
            ("weather_scatter_wind.sql", {"route_filter": "all"}),
            ("weather_route_vulnerability.sql", None),
            # Quality
            ("quality_overview.sql", None),
            ("quality_alerts.sql", None),
            # Schedules
            ("schedules_by_route.sql", None),
            ("schedules_timetable.sql", {"route_id": "Red", "direction_id": "0"}),
            ("schedules_timetable.sql", {"route_id": "Orange", "direction_id": "0"}),
            ("schedules_timetable.sql", {"route_id": "Blue", "direction_id": "0"}),
            ("schedules_timetable.sql", {"route_id": "Green-B", "direction_id": "0"}),
        ]

        success = 0
        failed = 0
        start = time.time()

        for filename, params in warmup_queries:
            try:
                await self.query_from_file(filename, params)
                success += 1
            except Exception as e:
                failed += 1
                logger.warning(f"Failed to warm {filename}: {e}")

        elapsed = time.time() - start
        logger.info(
            f"Cache warming complete: {success}/{success + failed} queries "
            f"in {elapsed:.1f}s"
        )
