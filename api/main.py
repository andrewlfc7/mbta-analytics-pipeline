from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

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
        logger.warning(f"Cache warming skipped (no credentials?): {e}")

    yield
    logger.info("Shutting down MBTA Analytics API...")


app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description="""
    MBTA Transit Analytics API

    Serves delay analysis, route reliability, weather impact,
    and station performance data for the MBTA transit system.

    Pipeline: MBTA V3 API → GCS → BigQuery → dbt → This API
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

app.include_router(overview.router, prefix=f"{settings.api_prefix}/overview", tags=["Overview"])
app.include_router(heatmap.router, prefix=f"{settings.api_prefix}/delays", tags=["Heatmap & Delays"])
app.include_router(temporal.router, prefix=f"{settings.api_prefix}/delays/temporal", tags=["Temporal Analysis"])
app.include_router(routes.router, prefix=f"{settings.api_prefix}/routes", tags=["Routes"])
app.include_router(stations.router, prefix=f"{settings.api_prefix}/stations", tags=["Stations"])
app.include_router(weather.router, prefix=f"{settings.api_prefix}/weather", tags=["Weather Impact"])
app.include_router(quality.router, prefix=f"{settings.api_prefix}/quality", tags=["Data Quality"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "version": settings.api_version,
        "bigquery_project": settings.gcp_project_id,
    }


@app.get("/", tags=["Health"])
async def root():
    return {"message": "MBTA Analytics API", "docs": "/docs", "health": "/health"}
