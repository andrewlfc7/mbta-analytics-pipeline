import logging
from typing import Any

import httpx
from fastapi import APIRouter, Query, Request

from api.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()

MBTA_CENTER_LAT = 42.3601
MBTA_CENTER_LON = -71.0589
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def _map_weather_code(weather_code: int | None) -> str:
    if weather_code in (0, 1):
        return "Clear"
    if weather_code in (2, 3):
        return "Cloudy"
    if weather_code in (45, 48):
        return "Fog"
    if weather_code in (51, 53, 55, 56, 57):
        return "Drizzle"
    if weather_code in (61, 63, 65, 66, 67):
        return "Rain"
    if weather_code in (71, 73, 75, 77):
        return "Snow"
    if weather_code in (80, 81, 82):
        return "Rain Showers"
    if weather_code in (85, 86):
        return "Snow Showers"
    if weather_code in (95, 96, 99):
        return "Thunderstorm"
    return "Unknown"


async def _fetch_live_weather() -> dict[str, Any]:
    params = {
        "latitude": MBTA_CENTER_LAT,
        "longitude": MBTA_CENTER_LON,
        "current": [
            "temperature_2m",
            "relative_humidity_2m",
            "wind_speed_10m",
            "precipitation",
            "weather_code",
        ],
        "temperature_unit": "fahrenheit",
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
        "timezone": "America/New_York",
    }
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(OPEN_METEO_URL, params=params)
        response.raise_for_status()
        payload = response.json()

    current = payload.get("current", {})
    weather_code = current.get("weather_code")
    return {
        "temp_f": current.get("temperature_2m"),
        "humidity": current.get("relative_humidity_2m"),
        "wind_mph": current.get("wind_speed_10m"),
        "precip_in": current.get("precipitation"),
        "weather_code": weather_code,
        "condition": _map_weather_code(weather_code),
        "timestamp": current.get("time"),
        "source": "open-meteo",
    }


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
    payload_cache_key = "weather_current_live_v1"
    cached_payload = bq.get_cached_payload(
        payload_cache_key,
        ttl_seconds=settings.live_weather_cache_ttl_seconds,
    )
    if cached_payload is not None:
        return {"data": cached_payload}

    try:
        payload = await _fetch_live_weather()
        bq.set_cached_payload(payload_cache_key, payload)
        return {"data": payload}
    except Exception as exc:
        logger.warning("Live weather fetch failed, falling back to warehouse: %s", exc)

    rows = await bq.query_from_file("weather_current.sql")
    if rows:
        data = dict(rows[0])
        data["source"] = "warehouse"
        return {"data": data}
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
    params = {"route_filter": route_id or "all"}
    rows = await bq.query_from_file(
        "weather_scatter_temp.sql", params=params
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
    params = {"route_filter": route_id or "all"}
    rows = await bq.query_from_file(
        "weather_scatter_wind.sql", params=params
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
