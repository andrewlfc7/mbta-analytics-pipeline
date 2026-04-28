import contextvars
import math
import time
from collections import deque
from threading import Lock
from typing import Any

request_profile_context: contextvars.ContextVar[dict[str, Any] | None] = (
    contextvars.ContextVar("request_profile_context", default=None)
)


def _empty_request_state() -> dict[str, Any]:
    return {
        "method": "",
        "path": "",
        "query_count": 0,
        "query_time_ms": 0.0,
        "cache_hits": 0,
        "cache_misses": 0,
        "cache_coalesced": 0,
        "cache_stale": 0,
    }


def _percentile(samples: deque[float], percentile: float) -> float:
    if not samples:
        return 0.0
    ordered = sorted(samples)
    index = max(0, math.ceil((percentile / 100) * len(ordered)) - 1)
    return round(ordered[index], 1)


class ApiProfiler:
    def __init__(self, sample_size: int = 300):
        self.sample_size = sample_size
        self._lock = Lock()
        self._route_stats: dict[str, dict[str, Any]] = {}
        self._query_stats: dict[str, dict[str, Any]] = {}
        self.started_at = time.time()

    def begin_request(self) -> contextvars.Token:
        return request_profile_context.set(_empty_request_state())

    def update_request_identity(self, method: str, path: str):
        current = request_profile_context.get()
        if current is None:
            return
        current["method"] = method
        current["path"] = path

    def record_query(
        self,
        name: str,
        *,
        elapsed_ms: float,
        bytes_processed: int = 0,
        row_count: int = 0,
        cache_status: str = "miss",
    ):
        current = request_profile_context.get()
        if current is not None:
            current["query_count"] += 1
            current["query_time_ms"] += elapsed_ms
            if cache_status == "hit":
                current["cache_hits"] += 1
            elif cache_status == "miss":
                current["cache_misses"] += 1
            elif cache_status == "coalesced":
                current["cache_coalesced"] += 1
            elif cache_status == "stale":
                current["cache_stale"] += 1

        with self._lock:
            stats = self._query_stats.setdefault(
                name,
                {
                    "count": 0,
                    "total_ms": 0.0,
                    "max_ms": 0.0,
                    "samples": deque(maxlen=self.sample_size),
                    "total_bytes": 0,
                    "total_rows": 0,
                    "cache_hits": 0,
                    "cache_misses": 0,
                    "cache_coalesced": 0,
                    "cache_stale": 0,
                },
            )
            stats["count"] += 1
            stats["total_ms"] += elapsed_ms
            stats["max_ms"] = max(stats["max_ms"], elapsed_ms)
            stats["samples"].append(elapsed_ms)
            stats["total_bytes"] += bytes_processed
            stats["total_rows"] += row_count
            if cache_status == "hit":
                stats["cache_hits"] += 1
            elif cache_status == "miss":
                stats["cache_misses"] += 1
            elif cache_status == "coalesced":
                stats["cache_coalesced"] += 1
            elif cache_status == "stale":
                stats["cache_stale"] += 1

    def end_request(
        self,
        token: contextvars.Token,
        *,
        status_code: int,
        elapsed_ms: float,
    ) -> dict[str, Any]:
        current = request_profile_context.get() or _empty_request_state()
        route_key = f'{current.get("method") or "GET"} {current.get("path") or "unknown"}'

        with self._lock:
            stats = self._route_stats.setdefault(
                route_key,
                {
                    "count": 0,
                    "errors": 0,
                    "total_ms": 0.0,
                    "max_ms": 0.0,
                    "samples": deque(maxlen=self.sample_size),
                    "total_query_count": 0,
                    "total_query_time_ms": 0.0,
                    "cache_hits": 0,
                    "cache_misses": 0,
                    "cache_coalesced": 0,
                    "cache_stale": 0,
                },
            )
            stats["count"] += 1
            stats["errors"] += 1 if status_code >= 500 else 0
            stats["total_ms"] += elapsed_ms
            stats["max_ms"] = max(stats["max_ms"], elapsed_ms)
            stats["samples"].append(elapsed_ms)
            stats["total_query_count"] += current["query_count"]
            stats["total_query_time_ms"] += current["query_time_ms"]
            stats["cache_hits"] += current["cache_hits"]
            stats["cache_misses"] += current["cache_misses"]
            stats["cache_coalesced"] += current["cache_coalesced"]
            stats["cache_stale"] += current["cache_stale"]

        request_profile_context.reset(token)
        return current

    def snapshot(self, limit: int = 20) -> dict[str, Any]:
        with self._lock:
            route_profiles = [
                {
                    "route": route,
                    "count": stats["count"],
                    "errors": stats["errors"],
                    "avg_ms": round(stats["total_ms"] / stats["count"], 1),
                    "p95_ms": _percentile(stats["samples"], 95),
                    "max_ms": round(stats["max_ms"], 1),
                    "avg_queries_per_request": round(
                        stats["total_query_count"] / stats["count"], 2
                    ),
                    "avg_query_time_ms": round(
                        stats["total_query_time_ms"] / stats["count"], 1
                    ),
                    "cache_hits": stats["cache_hits"],
                    "cache_misses": stats["cache_misses"],
                    "cache_coalesced": stats["cache_coalesced"],
                    "cache_stale": stats["cache_stale"],
                }
                for route, stats in self._route_stats.items()
                if stats["count"] > 0
            ]

            query_profiles = [
                {
                    "query": query,
                    "count": stats["count"],
                    "avg_ms": round(stats["total_ms"] / stats["count"], 1),
                    "p95_ms": _percentile(stats["samples"], 95),
                    "max_ms": round(stats["max_ms"], 1),
                    "avg_rows": round(stats["total_rows"] / stats["count"], 1),
                    "avg_bytes_processed": round(
                        stats["total_bytes"] / stats["count"], 1
                    ),
                    "cache_hits": stats["cache_hits"],
                    "cache_misses": stats["cache_misses"],
                    "cache_coalesced": stats["cache_coalesced"],
                    "cache_stale": stats["cache_stale"],
                }
                for query, stats in self._query_stats.items()
                if stats["count"] > 0
            ]

        route_profiles.sort(key=lambda item: item["avg_ms"], reverse=True)
        query_profiles.sort(key=lambda item: item["avg_ms"], reverse=True)

        return {
            "uptime_seconds": round(time.time() - self.started_at, 1),
            "route_profiles": route_profiles[:limit],
            "query_profiles": query_profiles[:limit],
        }
