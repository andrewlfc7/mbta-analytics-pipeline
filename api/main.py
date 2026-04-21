from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from api.config import get_settings
from api.services.bigquery import BigQueryService
from api.routers import (
    overview,
    heatmap,
    temporal,
    routes,
    stations,
    weather,
    predictions,
    quality,
)

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    logger.info("Starting MBTA Analytics API...")
    app.state.bq_service = BigQueryService(
        project_id=settings.gcp_project_id,
        dataset=settings.bigquery_dataset,
    )
    logger.info(f"BigQuery service initialized: {settings.gcp_project_id}")

    # Warm cache for common queries
    try:
        await app.state.bq_service.warm_cache()
        logger.info("Cache warmed successfully")
    except Exception as e:
        logger.warning(f"Cache warming failed: {e}")

    yield

    # Shutdown
    logger.info("Shutting down MBTA Analytics API...")


app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description="""
    MBTA Transit Analytics API

    Serves delay analysis, route reliability, weather impact,
    and ML prediction data for the MBTA transit system.

    Built on top of a GCP lakehouse pipeline:
    MBTA V3 API → GCS (Parquet) → dbt → BigQuery → This API
    """,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Register routers
app.include_router(
    overview.router,
    prefix=f"{settings.api_prefix}/overview",
    tags=["Overview"],
)
app.include_router(
    heatmap.router,
    prefix=f"{settings.api_prefix}/delays",
    tags=["Heatmap & Delays"],
)
app.include_router(
    temporal.router,
    prefix=f"{settings.api_prefix}/delays/temporal",
    tags=["Temporal Analysis"],
)
app.include_router(
    routes.router,
    prefix=f"{settings.api_prefix}/routes",
    tags=["Routes"],
)
app.include_router(
    stations.router,
    prefix=f"{settings.api_prefix}/stations",
    tags=["Stations"],
)
app.include_router(
    weather.router,
    prefix=f"{settings.api_prefix}/weather",
    tags=["Weather Impact"],
)
app.include_router(
    predictions.router,
    prefix=f"{settings.api_prefix}/predictions",
    tags=["ML Predictions"],
)
app.include_router(
    quality.router,
    prefix=f"{settings.api_prefix}/quality",
    tags=["Data Quality"],
)


# Health check (no prefix)
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "version": settings.api_version,
        "bigquery_project": settings.gcp_project_id,
    }


@app.get("/", tags=["Health"])
async def root():
    return {
        "message": "MBTA Analytics API",
        "docs": "/docs",
        "health": "/health",
    }