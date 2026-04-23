from fastapi import APIRouter, Query, Request
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/performance",
    summary="Station performance rankings with filtering",
)
async def get_station_performance(
    request: Request,
    sort_by: str = Query(
        "delay_hotspot_score",
        pattern="^(delay_hotspot_score|avg_delay_seconds|late_pct)$",
    ),
    limit: int = Query(50, ge=1, le=250),
):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file(
        "stations_performance_filtered.sql",
        params={"sort_by": sort_by, "limit": str(limit)},
    )
    return {"data": rows}


@router.get(
    "/delay-hotspots",
    summary="Top delay hotspot stations",
)
async def get_delay_hotspots(
    request: Request,
    limit: int = Query(5, ge=1, le=20),
):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file(
        "delay_hotspots.sql",
        params={"limit": str(limit)},
    )
    return {"data": rows}


@router.get("/map", summary="Station data for map visualization")
async def get_station_map(request: Request):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file("stations_map.sql")
    return {"data": rows}


@router.get(
    "/map/system",
    summary="Full system map -- route lines + station points with alerts",
)
async def get_system_map_data(request: Request):
    bq = request.app.state.bq_service

    route_lines = await bq.query_from_file("map_route_lines.sql")
    stations = await bq.query_from_file("map_stations.sql")

    routes_geojson = _build_route_geojson(route_lines)
    stations_geojson = _build_station_geojson(stations)

    return {
        "routes": routes_geojson,
        "stations": stations_geojson,
    }


@router.get(
    "/{stop_id}/details",
    summary="Detailed stats for a specific station",
)
async def get_station_details(request: Request, stop_id: str):
    bq = request.app.state.bq_service

    # Try enhanced query first
    try:
        rows = await bq.query_from_file(
            "stations_detail_enhanced.sql",
            params={"stop_id": stop_id},
        )
        if rows:
            result = dict(rows[0]) if not isinstance(rows[0], dict) else rows[0]
            # Serialize nested arrays
            for field in ("routes", "active_alerts"):
                if field in result and not isinstance(result[field], (list, str, type(None))):
                    try:
                        result[field] = [dict(r) for r in result[field]]
                    except Exception:
                        result[field] = str(result[field])
            return {"data": result}
    except Exception as e:
        logger.warning(f"Enhanced station detail failed, using fallback: {e}")

    # Fallback to existing query
    rows = await bq.query_from_file(
        "stations_detail.sql", params={"stop_id": stop_id}
    )
    if not rows:
        return {"error": f"No data for station {stop_id}"}
    return {"data": rows[0]}


def _build_route_geojson(route_lines: list[dict]) -> dict:
    routes: dict = defaultdict(lambda: {"coords": [], "meta": {}})

    for row in route_lines:
        rid = row.get("route_id", "")
        lat = row.get("latitude")
        lng = row.get("longitude")
        if lat is None or lng is None:
            continue

        routes[rid]["coords"].append([float(lng), float(lat)])
        if not routes[rid]["meta"]:
            color = row.get("route_color", "7F7F7F")
            if not color.startswith("#"):
                color = f"#{color}"
            routes[rid]["meta"] = {
                "route_id": rid,
                "route_type": row.get("route_type", 3),
                "route_type_desc": row.get("route_type_desc", ""),
                "color": color,
            }

    features = []
    for rid, data in routes.items():
        if len(data["coords"]) >= 2:
            features.append({
                "type": "Feature",
                "properties": data["meta"],
                "geometry": {
                    "type": "LineString",
                    "coordinates": data["coords"],
                },
            })

    return {"type": "FeatureCollection", "features": features}


def _build_station_geojson(stations: list[dict]) -> dict:
    features = []
    for row in stations:
        lat = row.get("latitude")
        lng = row.get("longitude")
        if lat is None or lng is None:
            continue

        features.append({
            "type": "Feature",
            "properties": {
                "stop_id": row.get("stop_id", ""),
                "stop_name": row.get("stop_name", ""),
                "municipality": row.get("municipality", ""),
                "avg_delay_minutes": row.get("avg_delay_minutes", 0),
                "delay_hotspot_score": row.get("delay_hotspot_score", 0),
                "routes_served": row.get("routes_served", 0),
                "alert_count": row.get("active_alert_count", 0),
                "late_pct": row.get("late_pct", 0),
            },
            "geometry": {
                "type": "Point",
                "coordinates": [float(lng), float(lat)],
            },
        })

    return {"type": "FeatureCollection", "features": features}