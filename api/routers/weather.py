from fastapi import APIRouter, Query, Request
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/overview",
    summary="Average delay by weather condition",
)
async def get_weather_overview(
    request: Request,
    route_id: str = Query("all"),
    period: str = Query("365d"),
):
    bq = request.app.state.bq_service
    period_days = int(period.replace("d", ""))

    rows = await bq.query_from_file(
        "weather_overview.sql",
        params={"route_filter": route_id, "period_days": str(period_days)},
    )

    clear_avg = next(
        (r["avg_delay_minutes"] for r in rows if r["condition"] == "Clear"),
        2.0,
    )

    for row in rows:
        row["multiplier"] = round(row["avg_delay_minutes"] / clear_avg, 1) if clear_avg else 0
        row["pct_increase"] = round(
            (row["avg_delay_minutes"] - clear_avg) / clear_avg * 100
        ) if clear_avg else 0

    return {"data": rows, "baseline_clear": clear_avg}


@router.get("/scatter/temperature", summary="Temperature vs delay scatter data")
async def get_temperature_scatter(
    request: Request,
    route_id: str = Query("all"),
    period: str = Query("365d"),
):
    bq = request.app.state.bq_service
    period_days = int(period.replace("d", ""))

    rows = await bq.query_from_file(
        "weather_scatter_temp.sql",
        params={"route_filter": route_id, "period_days": str(period_days)},
    )
    return {"data": rows}


@router.get("/scatter/precipitation", summary="Precipitation vs delay scatter data")
async def get_precipitation_scatter(
    request: Request,
    route_id: str = Query("all"),
    precip_type: str = Query("all", pattern="^(all|rain|snow)$"),
    period: str = Query("365d"),
):
    bq = request.app.state.bq_service
    period_days = int(period.replace("d", ""))

    rows = await bq.query_from_file(
        "weather_scatter_precip.sql",
        params={
            "route_filter": route_id,
            "precip_type": precip_type,
            "period_days": str(period_days),
        },
    )
    return {"data": rows}


@router.get("/scatter/wind", summary="Wind speed vs delay scatter data")
async def get_wind_scatter(
    request: Request,
    route_id: str = Query("all"),
    period: str = Query("365d"),
):
    bq = request.app.state.bq_service
    period_days = int(period.replace("d", ""))

    rows = await bq.query_from_file(
        "weather_scatter_wind.sql",
        params={"route_filter": route_id, "period_days": str(period_days)},
    )
    return {"data": rows}


@router.get("/day-matrix", summary="Weather condition × day of week delay matrix")
async def get_weather_day_matrix(
    request: Request,
    route_id: str = Query("all"),
    period: str = Query("365d"),
):
    bq = request.app.state.bq_service
    period_days = int(period.replace("d", ""))

    rows = await bq.query_from_file(
        "weather_day_matrix.sql",
        params={"route_filter": route_id, "period_days": str(period_days)},
    )

    if rows:
        worst = max(rows, key=lambda r: r["avg_delay_minutes"])
        best = min(rows, key=lambda r: r["avg_delay_minutes"])
        insight = (
            f"WORST: {worst['condition']} + {worst['day_of_week']} "
            f"= {worst['avg_delay_minutes']:.1f} min avg delay. "
            f"BEST: {best['condition']} + {best['day_of_week']} "
            f"= {best['avg_delay_minutes']:.1f} min."
        )
    else:
        insight = None

    return {"data": rows, "insight": insight}


@router.get("/route-vulnerability", summary="Route sensitivity to weather conditions")
async def get_route_vulnerability(
    request: Request,
    period: str = Query("365d"),
):
    bq = request.app.state.bq_service
    period_days = int(period.replace("d", ""))

    rows = await bq.query_from_file(
        "weather_route_vulnerability.sql",
        params={"period_days": str(period_days)},
    )

    for row in rows:
        clear = row.get("clear_avg") or 2.0
        snow = row.get("snow_avg") or 0.0
        row["snow_multiplier"] = round(snow / clear, 1) if clear > 0 else 0
        if row["snow_multiplier"] >= 3.5:
            row["sensitivity"] = "HIGH"
        elif row["snow_multiplier"] >= 2.5:
            row["sensitivity"] = "MEDIUM"
        else:
            row["sensitivity"] = "LOW"

    return {"data": rows}
