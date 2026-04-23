import logging

from fastapi import APIRouter, HTTPException, Query, Request

from api.models.heatmap import CellDetailResponse, HeatmapResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/heatmap",
    response_model=HeatmapResponse,
    summary="Delay heatmap by day of week and hour",
)
async def get_delay_heatmap(
    request: Request,
    route_id: str = Query("all", description="Route ID or 'all'"),
    period: str = Query("30d", pattern="^(7d|14d|30d|60d|90d)$"),
    direction: str = Query("all", pattern="^(all|inbound|outbound)$"),
    include_predictions: bool = Query(False),
):
    bq = request.app.state.bq_service
    period_days = int(period.replace("d", ""))

    params = {
        "route_filter": route_id,
        "period_days": str(period_days),
        "direction": direction,
    }

    try:
        rows = await bq.query_from_file("heatmap_day_hour.sql", params=params)
    except Exception as e:
        logger.error(f"Heatmap query failed: {e}")
        raise HTTPException(status_code=500, detail="Query failed")

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No data found for route={route_id}, period={period}",
        )

    # Calculate anomalies
    hour_avgs = {}
    for row in rows:
        hour = row["hour"]
        if hour not in hour_avgs:
            hour_avgs[hour] = []
        hour_avgs[hour].append(row["avg_delay_minutes"])

    hour_means = {h: sum(vals) / len(vals) for h, vals in hour_avgs.items()}

    for row in rows:
        row["is_anomaly"] = (
            row["avg_delay_minutes"] > 2 * hour_means.get(row["hour"], 0)
        )

    worst = max(rows, key=lambda r: r["avg_delay_minutes"])
    best = min(rows, key=lambda r: r["avg_delay_minutes"])
    total_trips = sum(r["trip_count"] for r in rows)

    return HeatmapResponse(
        data=rows,
        metadata={
            "route_id": route_id,
            "period": period,
            "direction": direction,
            "total_trips_analyzed": total_trips,
            "worst_cell": (
                f"{worst['day_of_week']} {worst['hour']}:00 "
                f"({worst['avg_delay_minutes']:.1f} min)"
            ),
            "best_cell": (
                f"{best['day_of_week']} {best['hour']}:00 "
                f"({best['avg_delay_minutes']:.1f} min)"
            ),
            "generated_at": "2026-04-21T12:00:00Z",
        },
    )


@router.get(
    "/heatmap/cell-detail",
    response_model=CellDetailResponse,
    summary="Detailed breakdown for a specific heatmap cell",
)
async def get_cell_detail(
    request: Request,
    route_id: str = Query(..., description="Route ID"),
    day_of_week: str = Query(..., description="e.g., Monday"),
    hour: int = Query(..., ge=0, le=23),
):
    bq = request.app.state.bq_service

    params = {
        "route_id": route_id,
        "day_of_week": day_of_week,
        "hour": str(hour),
    }

    try:
        stations = await bq.query_from_file("heatmap_cell_stations.sql", params=params)
        history = await bq.query_from_file("heatmap_cell_history.sql", params=params)
        summary = await bq.query_from_file("heatmap_cell_summary.sql", params=params)
    except Exception as e:
        logger.error(f"Cell detail query failed: {e}")
        raise HTTPException(status_code=500, detail="Query failed")

    if not summary:
        raise HTTPException(status_code=404, detail="No data for this cell")

    s = summary[0]

    return CellDetailResponse(
        route_id=route_id,
        day_of_week=day_of_week,
        hour=hour,
        avg_delay_minutes=s["avg_delay_minutes"],
        median_delay_minutes=s["median_delay_minutes"],
        trip_count=s["trip_count"],
        pct_late=s["pct_late"],
        predicted_delay_minutes=None,
        confidence=None,
        stations=stations,
        history=history,
    )
