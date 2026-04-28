import asyncio
import logging

from fastapi import APIRouter, Query, Request

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/search-stops", summary="Search stations by name")
async def search_stops(
    request: Request,
    q: str = Query(..., min_length=2, description="Search query"),
):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file(
        "trip_search_stops.sql",
        params={"query": q},
    )
    return {"data": rows}


@router.get("/find-routes", summary="Find routes between two stops")
async def find_routes(
    request: Request,
    origin: str = Query(..., description="Origin stop ID"),
    destination: str = Query(..., description="Destination stop ID"),
):
    bq = request.app.state.bq_service

    # Find direct and transfer routes
    routes = await bq.query_from_file(
        "trip_find_routes.sql",
        params={"origin_stop": origin, "dest_stop": destination},
    )

    # Get reliability data for found routes
    route_ids = list(
        set(
            [r.get("first_route_id") for r in routes if r.get("first_route_id")]
            + [r.get("second_route_id") for r in routes if r.get("second_route_id")]
        )
    )

    reliability: dict = {}

    async def fetch_reliability():
        if not route_ids:
            return []
        return await bq.query(
            f"""
            SELECT
              route_id,
              ROUND(SAFE_DIVIDE(COUNTIF(delay_seconds <= 120), COUNT(*)) * 100, 1) AS on_time_pct,
              ROUND(AVG(delay_seconds) / 60.0, 1) AS avg_delay_minutes,
              ROUND(SAFE_DIVIDE(COUNTIF(delay_seconds > 300), COUNT(*)) * 100, 1) AS delay_risk_pct
            FROM `{bq.project_id}.intermediate.int_scheduled_vs_actual`
            WHERE route_id IN UNNEST({route_ids})
            GROUP BY route_id
            """,
            use_cache=True,
        )

    rel_result, weather_result, alerts_result = await asyncio.gather(
        fetch_reliability(),
        bq.query_from_file("weather_current.sql"),
        bq.query_from_file(
            "alerts_active.sql",
            params={"severity": "", "limit": "100"},
        ),
        return_exceptions=True,
    )

    if not isinstance(rel_result, Exception):
        for r in rel_result:
            reliability[r["route_id"]] = r
    else:
        logger.warning(f"Reliability fetch failed: {rel_result}")

    weather = None
    if not isinstance(weather_result, Exception) and weather_result:
        weather = weather_result[0]

    alerts = []
    if not isinstance(alerts_result, Exception):
        alerts = alerts_result or []

    # Build trip options
    options = []
    seen = set()

    for route in routes:
        key = f"{route.get('first_route_id')}-{route.get('second_route_id', '')}"
        if key in seen:
            continue
        seen.add(key)

        first_id = route.get("first_route_id", "")
        second_id = route.get("second_route_id")
        first_rel = reliability.get(first_id, {})
        second_rel = reliability.get(second_id, {}) if second_id else {}

        # Calculate combined reliability
        if second_id:
            combined_otp = min(first_rel.get("on_time_pct", 70), second_rel.get("on_time_pct", 70))
            combined_delay = first_rel.get("avg_delay_minutes", 2) + second_rel.get(
                "avg_delay_minutes", 2
            )
            combined_risk = max(
                first_rel.get("delay_risk_pct", 10), second_rel.get("delay_risk_pct", 10)
            )
        else:
            combined_otp = first_rel.get("on_time_pct", 70)
            combined_delay = first_rel.get("avg_delay_minutes", 2)
            combined_risk = first_rel.get("delay_risk_pct", 10)

        # Route alerts
        route_alerts = [
            a
            for a in alerts
            if first_id in str(a.get("affected_routes", ""))
            or (second_id and second_id in str(a.get("affected_routes", "")))
        ]

        option = {
            "connection_type": route.get("connection_type", "direct"),
            "transfers": route.get("transfers", 0),
            "legs": [
                {
                    "route_id": first_id,
                    "route_name": route.get("first_route_name", first_id),
                    "route_type": route.get("first_route_type"),
                    "route_type_desc": route.get("first_route_type_desc", ""),
                    "route_color": route.get("first_route_color", "7F7F7F"),
                }
            ],
            "reliability": {
                "on_time_pct": combined_otp,
                "avg_delay_minutes": round(combined_delay, 1),
                "delay_risk_pct": combined_risk,
                "label": "High"
                if combined_otp >= 85
                else "Good"
                if combined_otp >= 70
                else "Fair"
                if combined_otp >= 55
                else "Poor",
            },
            "active_alerts": len(route_alerts),
            "alert_summaries": [a.get("header", "")[:80] for a in route_alerts[:3]],
        }

        if second_id:
            option["legs"].append(
                {
                    "route_id": second_id,
                    "route_name": route.get("second_route_name", second_id),
                    "route_type": route.get("second_route_type"),
                    "route_type_desc": route.get("second_route_type_desc", ""),
                    "route_color": route.get("second_route_color", "7F7F7F"),
                }
            )
            option["transfer_stop"] = {
                "stop_id": route.get("transfer_stop_id"),
                "stop_name": route.get("transfer_stop_name"),
            }

        options.append(option)

    # Sort: direct first, then by reliability
    options.sort(key=lambda x: (x["transfers"], -x["reliability"]["on_time_pct"]))

    return {
        "origin": origin,
        "destination": destination,
        "options": options[:10],
        "weather": weather,
        "total_options": len(options),
    }
