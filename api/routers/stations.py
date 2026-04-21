from fastapi import APIRouter, Query, Request
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/performance",
    summary="Station performance rankings",
)
async def get_station_performance(
    request: Request,
    sort_by: str = Query("delay_hotspot_score", pattern="^(delay_hotspot_score|avg_delay_seconds|late_pct)$"),
    limit: int = Query(50, ge=1, le=250),
):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file(
        "stations_performance.sql",
        params={"sort_by": sort_by, "limit": str(limit)},
    )
    return {"data": rows}


@router.get("/map", summary="Station data for map visualization")
async def get_station_map(request: Request):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file("stations_map.sql")
    return {"data": rows}


@router.get("/{stop_id}/details", summary="Detailed stats for a specific station")
async def get_station_details(request: Request, stop_id: str):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file(
        "stations_detail.sql", params={"stop_id": stop_id}
    )
    if not rows:
        return {"error": f"No data for station {stop_id}"}
    return {"data": rows[0]}
