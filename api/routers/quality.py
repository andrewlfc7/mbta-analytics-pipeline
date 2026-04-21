from fastapi import APIRouter, Request
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/overview",
    summary="Data quality overview",
    description="Returns row counts, freshness, and basic quality metrics.",
)
async def get_quality_overview(request: Request):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file("quality_overview.sql")
    return {"data": rows}


@router.get(
    "/alerts",
    summary="Active alert summary",
)
async def get_active_alerts(request: Request):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file("quality_alerts.sql")
    return {"data": rows, "total": len(rows)}
