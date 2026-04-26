import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse

from api.config import get_settings
from api.routers import (
    alerts,
    assistant,
    heatmap,
    overview,
    quality,
    routes,
    schedules,
    stations,
    temporal,
    trip_planner,
    weather,
)
from api.services.bigquery import BigQueryService
from api.services.profiler import ApiProfiler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()

try:
    import uvloop

    asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
except ImportError:
    uvloop = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting MBTA Analytics API...")
    if uvloop is not None:
        logger.info("uvloop event loop policy enabled")
    app.state.bq_service = BigQueryService(
        project_id=settings.gcp_project_id,
    )
    app.state.profiler = ApiProfiler(sample_size=settings.profiler_sample_size)
    app.state.bq_service.profiler = app.state.profiler
    logger.info(f"BigQuery service initialized: {settings.gcp_project_id}")

    try:
        await app.state.bq_service.warm_cache()
        logger.info("Cache warmed successfully")
    except Exception as e:
        logger.warning(f"Cache warming failed: {e}")

    yield
    logger.info("Shutting down MBTA Analytics API...")


app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description="MBTA Transit Intelligence API",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
    default_response_class=ORJSONResponse,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
app.add_middleware(
    GZipMiddleware,
    minimum_size=settings.compression_minimum_size,
    compresslevel=settings.compression_level,
)


@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    start = time.perf_counter()
    tracking_token = request.app.state.bq_service.begin_request_tracking()
    profiler_token = request.app.state.profiler.begin_request()
    response = None
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        route = request.scope.get("route")
        route_path = getattr(route, "path", request.url.path)
        request.app.state.profiler.update_request_identity(request.method, route_path)
    except HTTPException as exc:
        status_code = exc.status_code
        request.app.state.profiler.update_request_identity(request.method, request.url.path)
        raise
    except Exception:
        request.app.state.profiler.update_request_identity(request.method, request.url.path)
        raise
    finally:
        request_cache_info = request.app.state.bq_service.get_request_cache_info()
        request.app.state.bq_service.end_request_tracking(tracking_token)
        request_profile = request.app.state.profiler.end_request(
            profiler_token,
            status_code=status_code,
            elapsed_ms=(time.perf_counter() - start) * 1000,
        )

    elapsed = time.perf_counter() - start
    global_cache_info = request.app.state.bq_service.get_cache_info()
    response.headers["X-Response-Time"] = f"{elapsed:.3f}s"
    response.headers["X-Cache-Hit-Rate"] = (
        str(global_cache_info.get("hit_rate_pct", 0)) + "%"
    )
    response.headers["X-Cache-Hits"] = str(request_cache_info["hits"])
    response.headers["X-Cache-Misses"] = str(request_cache_info["misses"])
    response.headers["X-Cache-Coalesced"] = str(request_cache_info["coalesced"])
    response.headers["X-Cache-Stale"] = str(request_cache_info["stale"])
    response.headers["X-Profile-Query-Count"] = str(request_profile["query_count"])
    response.headers["X-Profile-Query-Time-Ms"] = str(
        round(request_profile["query_time_ms"], 1)
    )
    return response


app.include_router(overview.router, prefix=f"{settings.api_prefix}/overview", tags=["Overview"])
app.include_router(heatmap.router, prefix=f"{settings.api_prefix}/delays", tags=["Heatmap & Delays"])
app.include_router(temporal.router, prefix=f"{settings.api_prefix}/delays/temporal", tags=["Temporal Analysis"])
app.include_router(routes.router, prefix=f"{settings.api_prefix}/routes", tags=["Routes"])
app.include_router(stations.router, prefix=f"{settings.api_prefix}/stations", tags=["Stations"])
app.include_router(weather.router, prefix=f"{settings.api_prefix}/weather", tags=["Weather Impact"])
app.include_router(quality.router, prefix=f"{settings.api_prefix}/quality", tags=["Data Quality"])
app.include_router(alerts.router, prefix=f"{settings.api_prefix}/alerts", tags=["Alerts"])
app.include_router(assistant.router, prefix=f"{settings.api_prefix}/assistant", tags=["Assistant"])
app.include_router(schedules.router, prefix=f"{settings.api_prefix}/schedules", tags=["Schedules"])
app.include_router(trip_planner.router, prefix=f"{settings.api_prefix}/trip", tags=["Trip Planner"])


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "cache": app.state.bq_service.get_cache_info(),
    }


@app.get("/health/cache")
async def cache_health():
    return app.state.bq_service.get_cache_info()


@app.get("/health/profile")
async def profile_health(limit: int = 20):
    top_n = max(1, min(limit, settings.profiler_top_n * 2))
    return app.state.profiler.snapshot(limit=top_n)
