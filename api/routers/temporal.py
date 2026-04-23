import logging

from fastapi import APIRouter, Query, Request

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/day-of-week",
    summary="Delay statistics by day of week",
)
async def get_day_of_week_stats(
    request: Request,
    route_id: str = Query("all"),
    period: str = Query("90d", pattern="^(7d|14d|30d|60d|90d|180d)$"),
):
    bq = request.app.state.bq_service
    period_days = int(period.replace("d", ""))

    rows = await bq.query_from_file(
        "temporal_day_of_week.sql",
        params={"route_filter": route_id, "period_days": str(period_days)},
    )

    if rows:
        worst_day = max(rows, key=lambda r: r["avg_delay_minutes"])
        best_day = min(rows, key=lambda r: r["avg_delay_minutes"])
        system_avg = (
            sum(r["avg_delay_minutes"] * r["trip_count"] for r in rows)
            / sum(r["trip_count"] for r in rows)
        )
        worst_pct_above = (
            (worst_day["avg_delay_minutes"] - system_avg) / system_avg * 100
            if system_avg != 0 else 0
        )

        insight = (
            f"{worst_day['day_of_week']} has "
            f"{worst_pct_above:.0f}% higher delays than average "
            f"({worst_day['avg_delay_minutes']:.1f}m vs "
            f"{best_day['day_of_week']}'s "
            f"{best_day['avg_delay_minutes']:.1f}m)"
        )
    else:
        insight = None

    return {
        "data": rows,
        "insight": insight,
        "metadata": {
            "route_id": route_id,
            "period": period,
            "total_trips": sum(r["trip_count"] for r in rows) if rows else 0,
        },
    }


@router.get(
    "/hourly",
    summary="Delay statistics by hour of day",
)
async def get_hourly_stats(
    request: Request,
    route_id: str = Query("all"),
    day_type: str = Query("all", pattern="^(all|weekday|weekend)$"),
    period: str = Query("90d", pattern="^(7d|14d|30d|60d|90d|180d)$"),
):
    bq = request.app.state.bq_service
    period_days = int(period.replace("d", ""))

    rows = await bq.query_from_file(
        "temporal_hourly.sql",
        params={
            "route_filter": route_id,
            "day_type": day_type,
            "period_days": str(period_days),
        },
    )

    return {
        "data": rows,
        "metadata": {"route_id": route_id, "day_type": day_type, "period": period},
    }


@router.get(
    "/rush-hour-comparison",
    summary="AM Rush vs PM Rush vs Off-Peak stats",
)
async def get_rush_hour_comparison(
    request: Request,
    route_id: str = Query("all"),
    period: str = Query("90d"),
):
    bq = request.app.state.bq_service
    period_days = int(period.replace("d", ""))

    rows = await bq.query_from_file(
        "temporal_rush_hour.sql",
        params={"route_filter": route_id, "period_days": str(period_days)},
    )

    return {"data": rows}


@router.get(
    "/delay-probability",
    summary="Probability of >5min delay by hour",
)
async def get_delay_probability(
    request: Request,
    route_id: str = Query("all"),
    period: str = Query("90d"),
):
    bq = request.app.state.bq_service
    period_days = int(period.replace("d", ""))

    rows = await bq.query_from_file(
        "temporal_delay_probability.sql",
        params={"route_filter": route_id, "period_days": str(period_days)},
    )

    for row in rows:
        prob = row["delay_probability"]
        if prob >= 40:
            row["risk_level"] = "HIGH"
        elif prob >= 20:
            row["risk_level"] = "MEDIUM"
        else:
            row["risk_level"] = "LOW"

    return {"data": rows}


@router.get(
    "/scatter/day-of-week",
    summary="Individual trip delays for scatter plot by day",
)
async def get_scatter_day_of_week(
    request: Request,
    route_id: str = Query("all"),
    period: str = Query("30d"),
    sample_size: int = Query(5000, ge=100, le=50000),
):
    bq = request.app.state.bq_service
    period_days = int(period.replace("d", ""))

    rows = await bq.query_from_file(
        "scatter_day_of_week.sql",
        params={
            "route_filter": route_id,
            "period_days": str(period_days),
            "sample_size": str(sample_size),
        },
    )

    return {
        "data": rows,
        "metadata": {
            "route_id": route_id,
            "period": period,
            "sample_size": len(rows),
        },
    }
