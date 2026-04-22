from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
import time

from api.config import get_settings
from api.services.bigquery import BigQueryService
from api.routers import overview, heatmap, temporal, weather, routes, stations, quality

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting MBTA Analytics API...")
    app.state.bq_service = BigQueryService(
        project_id=settings.gcp_project_id,
    )
    logger.info(f"BigQuery service initialized (lazy): {settings.gcp_project_id}")

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
    description="""
    MBTA Transit Analytics API

    Serves delay analysis, route reliability, weather impact,
    and station performance data for the MBTA transit system.

    Pipeline: MBTA V3 API -> GCS -> BigQuery -> dbt -> This API
    """,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = time.time() - start
    response.headers["X-Response-Time"] = f"{elapsed:.3f}s"
    response.headers["X-Cache-Info"] = str(
        request.app.state.bq_service.get_cache_info().get("hit_rate_pct", 0)
    ) + "% hit rate"
    return response


app.include_router(overview.router, prefix=f"{settings.api_prefix}/overview", tags=["Overview"])
app.include_router(heatmap.router, prefix=f"{settings.api_prefix}/delays", tags=["Heatmap & Delays"])
app.include_router(temporal.router, prefix=f"{settings.api_prefix}/delays/temporal", tags=["Temporal Analysis"])
app.include_router(routes.router, prefix=f"{settings.api_prefix}/routes", tags=["Routes"])
app.include_router(stations.router, prefix=f"{settings.api_prefix}/stations", tags=["Stations"])
app.include_router(weather.router, prefix=f"{settings.api_prefix}/weather", tags=["Weather Impact"])
app.include_router(quality.router, prefix=f"{settings.api_prefix}/quality", tags=["Data Quality"])


@app.get("/health", tags=["Health"])
async def health_check(request: Request):
    cache_info = request.app.state.bq_service.get_cache_info()
    return {
        "status": "healthy",
        "version": settings.api_version,
        "bigquery_project": settings.gcp_project_id,
        "cache": cache_info,
    }


@app.get("/", tags=["Health"])
async def root():
    return {"message": "MBTA Analytics API", "docs": "/docs", "health": "/health"}


@app.post("/api/v1/cache/invalidate", tags=["Admin"])
async def invalidate_cache(request: Request):
    """Invalidate all caches. Call after DAG runs complete."""
    request.app.state.bq_service.invalidate_cache()
    return {"status": "cache invalidated"}


@app.post("/api/v1/cache/warm", tags=["Admin"])
async def warm_cache(request: Request):
    """Re-warm all caches."""
    await request.app.state.bq_service.warm_cache()
    cache_info = request.app.state.bq_service.get_cache_info()
    return {"status": "cache warmed", "cache": cache_info}


@app.get("/api/v1/metrics", tags=["Monitoring"])
async def get_metrics(request: Request):
    """Lightweight monitoring endpoint."""
    cache_info = request.app.state.bq_service.get_cache_info()
    return {
        "api_version": settings.api_version,
        "cache": cache_info,
        "config": {
            "cache_ttl_seconds": settings.cache_ttl_seconds,
            "workers": 2,
        },
    }