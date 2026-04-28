from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Query, Request

router = APIRouter()

NY_TZ = ZoneInfo("America/New_York")
SERVICE_DAY_CUTOFF_HOUR = 3


def _current_mbta_service_date() -> str:
    now = datetime.now(NY_TZ)

    if now.hour < SERVICE_DAY_CUTOFF_HOUR:
        now = now - timedelta(days=1)

    return now.date().isoformat()


def _date_window(start_date: str | None, end_date: str | None) -> dict[str, str]:
    start = start_date or _current_mbta_service_date()

    if end_date:
        end = end_date
    else:
        start_dt = datetime.fromisoformat(start)
        end = (start_dt + timedelta(days=7)).date().isoformat()

    return {"start_date": start, "end_date": end}


@router.get("/routes", summary="Schedule summary by route")
async def get_schedule_routes(
    request: Request,
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file(
        "schedules_by_route.sql",
        params=_date_window(start_date, end_date),
    )
    return {"data": rows}


@router.get("/timetable", summary="Route timetable")
async def get_timetable(
    request: Request,
    route_id: str = Query(..., description="Route ID"),
    direction_id: int = Query(0, ge=0, le=1),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file(
        "schedules_timetable.sql",
        params={
            "route_id": route_id,
            "direction_id": str(direction_id),
            **_date_window(start_date, end_date),
        },
    )
    return {"data": rows}


@router.get("/stop", summary="Departures from a stop")
async def get_stop_departures(
    request: Request,
    stop_id: str = Query(..., description="Stop ID"),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file(
        "schedules_stop_departures.sql",
        params={
            "stop_id": stop_id,
            **_date_window(start_date, end_date),
        },
    )
    return {"data": rows}
