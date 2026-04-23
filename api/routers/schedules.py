from fastapi import APIRouter, Query, Request
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/routes", summary="Schedule summary by route")
async def get_schedule_routes(request: Request):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file("schedules_by_route.sql")
    return {"data": rows}


@router.get("/timetable", summary="Route timetable")
async def get_timetable(
    request: Request,
    route_id: str = Query(..., description="Route ID"),
    direction_id: int = Query(0, ge=0, le=1),
):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file(
        "schedules_timetable.sql",
        params={"route_id": route_id, "direction_id": str(direction_id)},
    )
    return {"data": rows}


@router.get("/stop", summary="Departures from a stop")
async def get_stop_departures(
    request: Request,
    stop_id: str = Query(..., description="Stop ID"),
):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file(
        "schedules_stop_departures.sql",
        params={"stop_id": stop_id},
    )
    return {"data": rows}
