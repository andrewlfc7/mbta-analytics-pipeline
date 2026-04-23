from fastapi import APIRouter, Query, Request
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/active",
    summary="Active alerts with severity filtering",
)
async def get_active_alerts(
    request: Request,
    severity: str = Query("all", description="all, critical, major, minor, info"),
    limit: int = Query(20, ge=1, le=100),
):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file(
        "alerts_active.sql",
        params={"severity": severity, "limit": str(limit)},
    )

    alerts = []
    for row in rows:
        alert = dict(row) if not isinstance(row, dict) else row
        for field in ("affected_routes", "affected_stops"):
            if field in alert and not isinstance(alert[field], (list, str, type(None))):
                alert[field] = str(alert[field])
        alerts.append(alert)

    return {"data": alerts, "total": len(alerts)}


@router.get(
    "/by-mode",
    summary="Alert counts grouped by transit mode",
)
async def get_alerts_by_mode(request: Request):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file("alerts_by_mode.sql")
    return {"data": rows}


@router.get(
    "/summary",
    summary="Alert severity breakdown counts",
)
async def get_alert_summary(request: Request):
    bq = request.app.state.bq_service
    rows = await bq.query_from_file("overview_system_enhanced.sql")
    if rows:
        r = rows[0]
        return {
            "active_alerts": r.get("active_alerts", 0),
            "critical": r.get("critical_alerts", 0),
            "major": r.get("major_alerts", 0),
            "minor": r.get("minor_alerts", 0),
            "info": r.get("info_alerts", 0),
        }
    return {"active_alerts": 0, "critical": 0, "major": 0, "minor": 0, "info": 0}