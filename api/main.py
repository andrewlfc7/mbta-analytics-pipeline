import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from api.config import get_settings
from api.routers import alerts, heatmap, overview, quality, routes, schedules, stations, temporal, trip_planner, weather
from api.services.bigquery import BigQueryService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting MBTA Analytics API...")
    app.state.bq_service = BigQueryService(
        project_id=settings.gcp_project_id,
    )
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


@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = time.time() - start
    response.headers["X-Response-Time"] = f"{elapsed:.3f}s"
    response.headers["X-Cache-Info"] = (
        str(request.app.state.bq_service.get_cache_info().get("hit_rate_pct", 0))
        + "% hit rate"
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
app.include_router(schedules.router, prefix=f"{settings.api_prefix}/schedules", tags=["Schedules"])
app.include_router(trip_planner.router, prefix=f"{settings.api_prefix}/trip", tags=["Trip Planner"])


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "cache": app.state.bq_service.get_cache_info(),
    }
