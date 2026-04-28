import logging
from datetime import date, timedelta

from fastapi import APIRouter, Query, Request

logger = logging.getLogger(__name__)
router = APIRouter()


def default_start_date() -> str:
    return date.today().isoformat()


def default_end_date() -> str:
    return (date.today() + timedelta(days=7)).isoformat()


@router.get("/routes", summary="Schedule summary by route")
async def get_schedule_routes(
    request: Request,
    start_date: str = Query(default_factory=default_start_date),
    end_date: str = Query(default_factory=default_end_date),
):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file(
        "schedules_by_route.sql",
        params={"start_date": start_date, "end_date": end_date},
    )
    return {"data": rows}


@router.get("/timetable", summary="Route timetable")
async def get_timetable(
    request: Request,
    route_id: str = Query(..., description="Route ID"),
    direction_id: int = Query(0, ge=0, le=1),
    start_date: str = Query(default_factory=default_start_date),
    end_date: str = Query(default_factory=default_end_date),
):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file(
        "schedules_timetable.sql",
        params={
            "route_id": route_id,
            "direction_id": str(direction_id),
            "start_date": start_date,
            "end_date": end_date,
        },
    )
    return {"data": rows}


@router.get("/stop", summary="Departures from a stop")
async def get_stop_departures(
    request: Request,
    stop_id: str = Query(..., description="Stop ID"),
    start_date: str = Query(default_factory=default_start_date),
    end_date: str = Query(default_factory=default_end_date),
):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file(
        "schedules_stop_departures.sql",
        params={
            "stop_id": stop_id,
            "start_date": start_date,
            "end_date": end_date,
        },
    )
    return {"data": rows}
