import logging

from fastapi import APIRouter, Query, Request

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/system",
    summary="System-wide KPI overview (enhanced)",
)
async def get_system_overview(
    request: Request,
    mode: str = Query("all", description="all, bus, subway, commuter_rail, ferry"),
):
    bq = request.app.state.bq_service

    current = await bq.query_from_file("overview_system_enhanced.sql")

    try:
        previous = await bq.query_from_file("overview_system_prev_week.sql")
    except Exception:
        previous = None

    trips_by_mode_rows = await bq.query_from_file("overview_trips_by_mode.sql")
    trips_by_mode = {}
    for row in trips_by_mode_rows:
        mode_key = (
            row["mode"].lower().replace(" ", "_")
            if row.get("mode")
            else "unknown"
        )
        trips_by_mode[mode_key] = row["trips"]

    if current:
        c = current[0]
        p = previous[0] if previous else {}

        prev_on_time = p.get("on_time_pct", c.get("on_time_pct", 0))
        prev_delay = p.get("avg_delay_minutes", c.get("avg_delay_minutes", 0))
        prev_trips = p.get("total_trips", c.get("total_trips", 0))
        prev_alerts = p.get("active_alerts", c.get("active_alerts", 0))

        total_trips = c.get("total_trips", 0)
        trips_change_pct = round(
            ((total_trips - prev_trips) / prev_trips * 100)
            if prev_trips > 0
            else 0,
            1,
        )

        return {
            "total_trips": total_trips,
            "on_time_pct": c.get("on_time_pct", 0),
            "avg_delay_minutes": c.get("avg_delay_minutes", 0),
            "active_alerts": c.get("active_alerts", 0),
            "critical_alerts": c.get("critical_alerts", 0),
            "major_alerts": c.get("major_alerts", 0),
            "minor_alerts": c.get("minor_alerts", 0),
            "info_alerts": c.get("info_alerts", 0),
            "on_time_pct_change": round(
                c.get("on_time_pct", 0) - prev_on_time, 1
            ),
            "avg_delay_change": round(
                c.get("avg_delay_minutes", 0) - prev_delay, 1
            ),
            "total_trips_change": total_trips - prev_trips,
            "trips_change_pct": trips_change_pct,
            "active_alerts_change": c.get("active_alerts", 0) - prev_alerts,
            "trips_by_mode": trips_by_mode,
            "last_updated": str(c.get("last_updated", "")),
        }
    else:
        return {"error": "No data available"}


@router.get(
    "/route-ranking",
    summary="Routes ranked by on-time % with mode filter",
)
async def get_route_ranking(
    request: Request,
    period: str = Query("30d"),
    mode: str = Query("all"),
    limit: int = Query(10, ge=1, le=50),
):
    bq = request.app.state.bq_service

    rows = await bq.query_from_file(
        "overview_route_ranking_filtered.sql",
        params={"mode": mode, "limit": str(limit)},
    )
    return {"data": rows}


@router.get(
    "/trips-by-mode",
    summary="Trip counts grouped by transit mode",
)
async def get_trips_by_mode(request: Request):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file("overview_trips_by_mode.sql")
    return {"data": rows}


@router.get(
    "/performance-trends",
    summary="Hourly performance trends by mode",
)
async def get_performance_trends(
    request: Request,
    day_type: str = Query("weekday", pattern="^(weekday|weekend)$"),
):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file(
        "overview_performance_trends.sql",
        params={"day_type": day_type},
    )
    return {"data": rows}


@router.get(
    "/reliability-trend",
    summary="System reliability over time by route",
)
async def get_reliability_trend(
    request: Request,
    period: str = Query("30d"),
    granularity: str = Query("daily", pattern="^(daily|weekly)$"),
):
    bq = request.app.state.bq_service
    period_days = int(period.replace("d", ""))

    rows = await bq.query_from_file(
        "overview_reliability_trend.sql",
        params={
            "period_days": str(period_days),
            "granularity": granularity,
        },
    )
    return {"data": rows}
