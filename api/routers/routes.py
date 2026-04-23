import logging

from fastapi import APIRouter, Request

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/reliability",
    summary="Route reliability rankings",
    description="Returns all routes with on-time %, avg delay, reliability score.",
)
async def get_route_reliability(request: Request):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file("routes_reliability.sql")
    return {"data": rows}


@router.get(
    "/{route_id}/details",
    summary="Detailed stats for a specific route",
)
async def get_route_details(request: Request, route_id: str):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file(
        "routes_detail.sql", params={"route_id": route_id}
    )
    if not rows:
        return {"error": f"No data for route {route_id}"}
    return {"data": rows[0]}


@router.get(
    "/{route_id}/hourly",
    summary="Hourly delay breakdown for a route",
)
async def get_route_hourly(request: Request, route_id: str):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file(
        "routes_hourly.sql", params={"route_id": route_id}
    )
    return {"data": rows}
