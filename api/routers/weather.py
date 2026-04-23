from fastapi import APIRouter, Query, Request
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/overview",
    summary="Weather overview with delay correlations",
)
async def get_weather_overview(
    request: Request,
    route_id: str = Query(None),
):
    bq = request.app.state.bq_service
    params = {}
    if route_id:
        params["route_id"] = route_id
    rows = await bq.query_from_file("weather_overview.sql", params=params or None)
    return {"data": rows}


@router.get(
    "/current",
    summary="Current weather conditions",
)
async def get_current_weather(request: Request):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file("weather_current.sql")
    if rows:
        return {"data": rows[0]}
    return {"data": None}


@router.get(
    "/delay-impact",
    summary="Weather condition impact on delays",
)
async def get_weather_delay_impact(request: Request):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file("weather_delay_impact.sql")
    return {"data": rows}


@router.get(
    "/scatter/temperature",
    summary="Temperature vs delay scatter data",
)
async def get_temp_scatter(
    request: Request,
    route_id: str = Query(None),
):
    bq = request.app.state.bq_service
    params = {}
    if route_id:
        params["route_id"] = route_id
    rows = await bq.query_from_file(
        "weather_scatter_temp.sql", params=params or None
    )
    return {"data": rows}


@router.get(
    "/scatter/wind",
    summary="Wind speed vs delay scatter data",
)
async def get_wind_scatter(
    request: Request,
    route_id: str = Query(None),
):
    bq = request.app.state.bq_service
    params = {}
    if route_id:
        params["route_id"] = route_id
    rows = await bq.query_from_file(
        "weather_scatter_wind.sql", params=params or None
    )
    return {"data": rows}


@router.get(
    "/route-vulnerability",
    summary="Route vulnerability to weather",
)
async def get_route_vulnerability(request: Request):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file("weather_route_vulnerability.sql")
    return {"data": rows}