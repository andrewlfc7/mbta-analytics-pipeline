from fastapi import APIRouter, Query, Request
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/system",
    summary="System-wide KPI overview",
    description="Returns current on-time %, active alerts, avg delay, "
                "trip count, and week-over-week changes.",
)
async def get_system_overview(request: Request):
    bq = request.app.state.bq_service

    current = await bq.query_from_file("overview_system.sql")
    previous = await bq.query_from_file("overview_system_prev_week.sql")

    if current and previous:
        c, p = current[0], previous[0]
        return {
            "on_time_pct": c["on_time_pct"],
            "on_time_pct_change": round(
                c["on_time_pct"] - p["on_time_pct"], 1
            ),
            "active_alerts": c["active_alerts"],
            "active_alerts_change": (
                c["active_alerts"] - p["active_alerts"]
            ),
            "avg_delay_minutes": c["avg_delay_minutes"],
            "avg_delay_change": round(
                c["avg_delay_minutes"] - p["avg_delay_minutes"], 1
            ),
            "total_trips": c["total_trips"],
            "total_trips_change": (
                c["total_trips"] - p["total_trips"]
            ),
            "last_updated": c.get("last_updated", ""),
        }
    elif current:
        return current[0]
    else:
        return {"error": "No data available"}


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


@router.get(
    "/route-ranking",
    summary="All routes ranked by on-time percentage",
)
async def get_route_ranking(
    request: Request,
    period: str = Query("30d"),
):
    bq = request.app.state.bq_service
    period_days = int(period.replace("d", ""))

    rows = await bq.query_from_file(
        "overview_route_ranking.sql",
        params={"period_days": str(period_days)},
    )

    return {"data": rows}
