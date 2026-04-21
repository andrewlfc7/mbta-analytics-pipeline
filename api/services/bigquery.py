from google.cloud import bigquery
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
    def __init__(self, project_id: str, dataset: str):
        self.project_id = project_id
        self.dataset = dataset
        self.client = bigquery.Client(project=project_id)
        self.cache: dict[str, dict[str, Any]] = {}
        self.cache_dir = Path(settings.cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _cache_key(self, query: str, params: dict | None = None) -> str:
        """Generate cache key from query + params."""
        content = query + json.dumps(params or {}, sort_keys=True)
        return hashlib.md5(content.encode()).hexdigest()

    def _get_cached(self, key: str) -> list[dict] | None:
        """Check in-memory cache first, then file cache."""
        # In-memory
        if key in self.cache:
            entry = self.cache[key]
            if time.time() - entry["timestamp"] < settings.cache_ttl_seconds:
                logger.debug(f"Cache HIT (memory): {key[:8]}")
                return entry["data"]
            else:
                del self.cache[key]

        # File cache
        cache_file = self.cache_dir / f"{key}.json"
        if cache_file.exists():
            stat = cache_file.stat()
            if time.time() - stat.st_mtime < settings.cache_ttl_seconds:
                logger.debug(f"Cache HIT (file): {key[:8]}")
                with open(cache_file) as f:
                    data = json.load(f)
                # Promote to memory
                self.cache[key] = {
                    "data": data,
                    "timestamp": stat.st_mtime,
                }
                return data

        return None

    def _set_cached(self, key: str, data: list[dict]):
        """Write to both memory and file cache."""
        self.cache[key] = {
            "data": data,
            "timestamp": time.time(),
        }
        cache_file = self.cache_dir / f"{key}.json"
        with open(cache_file, "w") as f:
            json.dump(data, f)

    async def query(
        self,
        query: str,
        params: dict | None = None,
        use_cache: bool = True,
    ) -> list[dict]:
        """Execute BigQuery query with caching."""
        cache_key = self._cache_key(query, params)

        if use_cache:
            cached = self._get_cached(cache_key)
            if cached is not None:
                return cached

        try:
            logger.info(f"Executing BigQuery query: {cache_key[:8]}...")

            job_config = bigquery.QueryJobConfig()
            if params:
                job_config.query_parameters = [
                    bigquery.ScalarQueryParameter(k, "STRING", str(v))
                    for k, v in params.items()
                ]

            query_job = self.client.query(query, job_config=job_config)
            results = query_job.result()

            rows = [dict(row) for row in results]

            if use_cache:
                self._set_cached(cache_key, rows)

            logger.info(
                f"Query returned {len(rows)} rows "
                f"({query_job.total_bytes_processed / 1024:.1f} KB processed)"
            )
            return rows

        except GoogleAPIError as e:
            logger.error(f"BigQuery error: {e}")
            raise

    async def query_from_file(
        self,
        filename: str,
        params: dict | None = None,
        use_cache: bool = True,
    ) -> list[dict]:
        """Load and execute SQL from queries/ directory."""
        query_path = Path(__file__).parent.parent / "queries" / filename
        query = query_path.read_text()

        # Simple param substitution
        if params:
            for key, value in params.items():
                query = query.replace(f"@{key}", f"'{value}'")

        return await self.query(query, use_cache=use_cache)

    async def warm_cache(self):
        """Pre-warm cache with common queries on startup."""
        logger.info("Warming cache...")
        warmup_queries = [
            "overview_system.sql",
            "heatmap_day_hour.sql",
            "temporal_day_of_week.sql",
        ]
        for filename in warmup_queries:
            try:
                await self.query_from_file(filename)
            except Exception as e:
                logger.warning(f"Failed to warm {filename}: {e}")