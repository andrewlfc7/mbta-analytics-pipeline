from google.cloud import bigquery
from google.oauth2 import service_account
from google.api_core.exceptions import GoogleAPIError
import hashlib
import json
import os
import time
import logging
from pathlib import Path
from typing import Any

from api.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class BigQueryService:
    def __init__(self, project_id: str):
        self.project_id = project_id
        self._client = None
        self.cache: dict[str, dict[str, Any]] = {}
        self.cache_dir = Path(settings.cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache_stats = {"hits": 0, "misses": 0, "errors": 0}

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

    def _get_cached(self, key: str) -> list[dict] | None:
        # Check in-memory first
        if key in self.cache:
            entry = self.cache[key]
            if time.time() - entry["timestamp"] < settings.cache_ttl_seconds:
                self.cache_stats["hits"] += 1
                return entry["data"]
            else:
                del self.cache[key]

        # Check file cache
        cache_file = self.cache_dir / f"{key}.json"
        if cache_file.exists():
            stat = cache_file.stat()
            if time.time() - stat.st_mtime < settings.cache_ttl_seconds:
                try:
                    with open(cache_file) as f:
                        data = json.load(f)
                    self.cache[key] = {"data": data, "timestamp": stat.st_mtime}
                    self.cache_stats["hits"] += 1
                    return data
                except (json.JSONDecodeError, OSError):
                    pass

        self.cache_stats["misses"] += 1
        return None

    def _set_cached(self, key: str, data: list[dict]):
        self.cache[key] = {"data": data, "timestamp": time.time()}
        try:
            cache_file = self.cache_dir / f"{key}.json"
            with open(cache_file, "w") as f:
                json.dump(data, f, default=str)
        except OSError as e:
            logger.warning(f"Failed to write cache file: {e}")

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
            "hits": self.cache_stats["hits"],
            "misses": self.cache_stats["misses"],
            "hit_rate_pct": hit_rate,
            "ttl_seconds": settings.cache_ttl_seconds,
            "errors": self.cache_stats["errors"],
        }

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

        try:
            start = time.time()
            logger.info(f"Executing BigQuery query: {cache_key[:8]}...")
            query_job = self.client.query(query)
            results = query_job.result()
            rows = [dict(row) for row in results]
            elapsed = time.time() - start

            if use_cache:
                self._set_cached(cache_key, rows)

            logger.info(
                f"Query {cache_key[:8]} returned {len(rows)} rows in {elapsed:.2f}s "
                f"({query_job.total_bytes_processed / 1024:.1f} KB processed)"
            )
            return rows

        except GoogleAPIError as e:
            self.cache_stats["errors"] += 1
            logger.error(f"BigQuery error: {e}")
            # Return stale cache if available
            if cache_key in self.cache:
                logger.warning(f"Returning stale cache for {cache_key[:8]}")
                return self.cache[cache_key]["data"]
            raise

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
        """Warm cache for all common endpoints on startup."""
        logger.info("Warming cache for all endpoints...")
        warmup_queries = [
            # Overview
            ("overview_system.sql", None),
            ("overview_system_prev_week.sql", None),
            ("overview_route_ranking.sql", None),
            # Routes
            ("routes_reliability.sql", None),
            ("routes_hourly.sql", {"route_id": "Red"}),
            ("routes_hourly.sql", {"route_id": "Blue"}),
            ("routes_hourly.sql", {"route_id": "Orange"}),
            ("routes_hourly.sql", {"route_id": "Green-B"}),
            ("routes_hourly.sql", {"route_id": "Green-C"}),
            ("routes_hourly.sql", {"route_id": "Green-D"}),
            ("routes_hourly.sql", {"route_id": "Green-E"}),
            # Delays
            ("heatmap_day_hour.sql", None),
            ("temporal_day_of_week.sql", None),
            ("temporal_hourly.sql", None),
            ("temporal_rush_hour.sql", None),
            ("temporal_delay_probability.sql", None),
            # Stations
            ("stations_performance.sql", {"sort_by": "delay_hotspot_score", "limit": "50"}),
            ("stations_map.sql", None),
            # Weather
            ("weather_overview.sql", None),
            ("weather_scatter_temp.sql", None),
            ("weather_scatter_wind.sql", None),
            ("weather_route_vulnerability.sql", None),
            # Quality
            ("quality_overview.sql", None),
            ("quality_alerts.sql", None),
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