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
                # Fallback to default credentials
                self._client = bigquery.Client(project=self.project_id)
                logger.info("BigQuery client created with default credentials")
        return self._client

    def _cache_key(self, query: str, params: dict | None = None) -> str:
        content = query + json.dumps(params or {}, sort_keys=True)
        return hashlib.md5(content.encode()).hexdigest()

    def _get_cached(self, key: str) -> list[dict] | None:
        if key in self.cache:
            entry = self.cache[key]
            if time.time() - entry["timestamp"] < settings.cache_ttl_seconds:
                return entry["data"]
            else:
                del self.cache[key]

        cache_file = self.cache_dir / f"{key}.json"
        if cache_file.exists():
            stat = cache_file.stat()
            if time.time() - stat.st_mtime < settings.cache_ttl_seconds:
                with open(cache_file) as f:
                    data = json.load(f)
                self.cache[key] = {"data": data, "timestamp": stat.st_mtime}
                return data
        return None

    def _set_cached(self, key: str, data: list[dict]):
        self.cache[key] = {"data": data, "timestamp": time.time()}
        cache_file = self.cache_dir / f"{key}.json"
        with open(cache_file, "w") as f:
            json.dump(data, f, default=str)

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
            logger.info(f"Executing BigQuery query: {cache_key[:8]}...")
            query_job = self.client.query(query)
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
        query_path = Path(__file__).parent.parent / "queries" / filename
        query = query_path.read_text()

        query = query.replace("{project}", self.project_id)

        if params:
            for key, value in params.items():
                query = query.replace(f"@{key}", f"{value}")

        return await self.query(query, use_cache=use_cache)

    async def warm_cache(self):
        logger.info("Warming cache...")
        warmup_queries = [
            ("overview_system.sql", None),
            ("overview_route_ranking.sql", None),
        ]
        for filename, params in warmup_queries:
            try:
                await self.query_from_file(filename, params)
            except Exception as e:
                logger.warning(f"Failed to warm {filename}: {e}")
