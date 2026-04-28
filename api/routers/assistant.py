import re

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

router = APIRouter()

SUGGESTIONS = [
    "What are the biggest delays right now?",
    "Are buses running normally in Somerville?",
    "How is weather affecting service?",
    "What's the best route from Back Bay to Harvard?",
]

MODE_KEYWORDS = {
    "bus": "Bus",
    "subway": "Heavy Rail",
    "red line": "Red",
    "orange line": "Orange",
    "blue line": "Blue",
    "green line": "Green",
    "commuter rail": "Commuter Rail",
    "ferry": "Ferry",
}

TRIP_REQUEST_RE = re.compile(
    r"\bfrom\s+(.+?)\s+to\s+(.+?)"
    r"(?:\s+(?:right now|now|today|tonight|this morning|"
    r"this afternoon|this evening)|[?.!,]|$)",
    re.IGNORECASE,
)


class AssistantQueryRequest(BaseModel):
    message: str = Field(min_length=2, max_length=500)


def _detect_route_or_mode(message: str) -> str | None:
    lower = message.lower()
    for phrase, value in MODE_KEYWORDS.items():
        if phrase in lower:
            return value
    return None


def _extract_trip_request(message: str) -> tuple[str, str] | None:
    match = TRIP_REQUEST_RE.search(message)
    if not match:
        return None
    return match.group(1).strip(), match.group(2).strip()


async def _find_stop_candidates(bq, query: str, limit: int = 8) -> list[dict]:
    rows = await bq.query_from_file(
        "trip_search_stops.sql",
        params={"query": query},
    )
    return rows[:limit] if rows else []


async def _find_best_stop(bq, query: str) -> dict | None:
    rows = await _find_stop_candidates(bq, query, limit=1)
    return rows[0] if rows else None


async def _build_trip_options(bq, origin: str, destination: str) -> list[dict]:
    routes = await bq.query_from_file(
        "trip_find_routes.sql",
        params={"origin_stop": origin, "dest_stop": destination},
    )

    route_ids = list(
        set(
            [r.get("first_route_id") for r in routes if r.get("first_route_id")]
            + [r.get("second_route_id") for r in routes if r.get("second_route_id")]
        )
    )

    reliability = {}
    if route_ids:
        rel_rows = await bq.query(
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
        for row in rel_rows:
            reliability[row["route_id"]] = row

    alerts = await bq.query_from_file(
        "alerts_active.sql",
        params={"severity": "all", "limit": "50"},
    )

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

        if second_id:
            combined_otp = min(
                first_rel.get("on_time_pct", 70),
                second_rel.get("on_time_pct", 70),
            )
            combined_delay = first_rel.get("avg_delay_minutes", 2) + second_rel.get(
                "avg_delay_minutes", 2
            )
            combined_risk = max(
                first_rel.get("delay_risk_pct", 10),
                second_rel.get("delay_risk_pct", 10),
            )
        else:
            combined_otp = first_rel.get("on_time_pct", 70)
            combined_delay = first_rel.get("avg_delay_minutes", 2)
            combined_risk = first_rel.get("delay_risk_pct", 10)

        route_alerts = [
            a
            for a in alerts
            if first_id in str(a.get("affected_routes", ""))
            or (second_id and second_id in str(a.get("affected_routes", "")))
        ]

        legs = [
            {
                "route_id": first_id,
                "route_name": route.get("first_route_name", first_id),
            }
        ]

        if second_id:
            legs.append(
                {
                    "route_id": second_id,
                    "route_name": route.get("second_route_name", second_id),
                }
            )

        options.append(
            {
                "transfers": route.get("transfers", 0),
                "connection_type": route.get("connection_type", "direct"),
                "legs": legs,
                "transfer_stop_name": route.get("transfer_stop_name"),
                "reliability": {
                    "on_time_pct": combined_otp,
                    "avg_delay_minutes": round(combined_delay, 1),
                    "delay_risk_pct": combined_risk,
                    "label": (
                        "High"
                        if combined_otp >= 85
                        else "Good"
                        if combined_otp >= 70
                        else "Fair"
                        if combined_otp >= 55
                        else "Poor"
                    ),
                },
                "active_alerts": len(route_alerts),
                "alert_summaries": [a.get("header", "") for a in route_alerts[:3]],
            }
        )

    options.sort(key=lambda x: (x["transfers"], -x["reliability"]["on_time_pct"]))
    return options


@router.post("/query", summary="Transit Assistant query")
async def assistant_query(payload: AssistantQueryRequest, request: Request):
    bq = request.app.state.bq_service
    message = payload.message.strip()
    lower = message.lower()

    trip_request = _extract_trip_request(message)
    if trip_request:
        origin_query, destination_query = trip_request
        origin_candidates = await _find_stop_candidates(bq, origin_query, limit=8)
        destination_candidates = await _find_stop_candidates(bq, destination_query, limit=8)

        if not origin_candidates or not destination_candidates:
            return {
                "kind": "trip",
                "answer": (
                    "I couldn't confidently match both stops. Try using a nearby stop, "
                    "station, or neighborhood name like 'Forest Hills' or 'Hyde Park Ave'."
                ),
                "cards": [],
                "items": [],
                "suggestions": SUGGESTIONS,
            }

        origin = origin_candidates[0]
        destination = destination_candidates[0]
        options = []

        for o in origin_candidates:
            for d in destination_candidates:
                candidate_options = await _build_trip_options(
                    bq,
                    o["stop_id"],
                    d["stop_id"],
                )
                if candidate_options:
                    origin = o
                    destination = d
                    options = candidate_options
                    break
            if options:
                break

        if not options:
            return {
                "kind": "trip",
                "answer": (
                            f"I couldn't find a route from {origin['stop_name']} "
                            f"to {destination['stop_name']} right now."
                        ),
                "cards": [],
                "items": [],
                "suggestions": SUGGESTIONS,
            }

        best = options[0]
        leg_names = " → ".join(leg["route_name"] for leg in best["legs"])
        transfer_text = (
            f"Transfer at {best['transfer_stop_name']}"
            if best.get("transfer_stop_name")
            else "Direct trip"
        )

        return {
            "kind": "trip",
            "answer": (
                f"Best option from {origin['stop_name']} "
                f"to {destination['stop_name']} is {leg_names}. "
                f"It's {best['reliability']['on_time_pct']}% on-time with about "
                f"{best['reliability']['avg_delay_minutes']} minutes of average delay."
            ),
            "cards": [
                {
                    "title": "Reliability",
                    "value": f"{best['reliability']['on_time_pct']}%",
                    "detail": best["reliability"]["label"],
                    "tone": "positive",
                },
                {
                    "title": "Avg Delay",
                    "value": f"{best['reliability']['avg_delay_minutes']} min",
                    "detail": f"{best['reliability']['delay_risk_pct']}% delay risk",
                    "tone": "warning",
                },
                {
                    "title": "Transfers",
                    "value": str(best["transfers"]),
                    "detail": transfer_text,
                    "tone": "default",
                },
            ],
            "items": [
                {
                    "title": leg_names,
                    "detail": transfer_text,
                    "meta": f"{best['active_alerts']} active alerts",
                    "tone": best["reliability"]["label"].lower(),
                }
            ]
            + [
                {
                    "title": alert,
                    "detail": "Service alert on this route",
                    "meta": "",
                    "tone": "warning",
                }
                for alert in best["alert_summaries"]
            ],
            "suggestions": [
                "How reliable is the Red Line right now?",
                "Are there alerts affecting this trip?",
                "What are the biggest delays right now?",
            ],
        }

    if any(term in lower for term in ["weather", "rain", "snow", "wind", "temperature"]):
        weather_rows = await bq.query_from_file("weather_current.sql")
        system_rows = await bq.query_from_file("overview_system_enhanced.sql")
        weather = weather_rows[0] if weather_rows else {}
        system = system_rows[0] if system_rows else {}

        return {
            "kind": "weather",
            "answer": (
                f"Current weather is {weather.get('condition', 'unknown').lower()} at "
                f"{round(weather.get('temp_f', 0))}°F. System-wide delay is averaging "
                f"{system.get('avg_delay_minutes', 0)} minutes."
            ),
            "cards": [
                {
                    "title": "Temperature",
                    "value": f"{round(weather.get('temp_f', 0))}°F",
                    "detail": weather.get("condition", "Current conditions"),
                    "tone": "default",
                },
                {
                    "title": "Wind",
                    "value": f"{round(weather.get('wind_mph', 0))} mph",
                    "detail": "Current wind speed",
                    "tone": "default",
                },
                {
                    "title": "Network Delay",
                    "value": f"{system.get('avg_delay_minutes', 0)} min",
                    "detail": "Average delay right now",
                    "tone": "warning",
                },
            ],
            "items": [],
            "suggestions": [
                "How are delays looking right now?",
                "Are there weather-related alerts?",
                "What's the best route from Back Bay to Harvard?",
            ],
        }

    if any(term in lower for term in ["delay", "hotspot", "worst", "slowest"]):
        hotspots = await bq.query_from_file("delay_hotspots.sql", params={"limit": "5"})
        system_rows = await bq.query_from_file("overview_system_enhanced.sql")
        system = system_rows[0] if system_rows else {}

        lead = hotspots[0] if hotspots else {}
        return {
            "kind": "delays",
            "answer": (
                f"The biggest delay hotspot right now is {lead.get('stop_name', 'not available')}. "
                f"System-wide delay is averaging {system.get('avg_delay_minutes', 0)} minutes."
            ),
            "cards": [
                {
                    "title": "Avg System Delay",
                    "value": f"{system.get('avg_delay_minutes', 0)} min",
                    "detail": "Across all modes",
                    "tone": "warning",
                },
                {
                    "title": "Top Hotspot",
                    "value": lead.get("stop_name", "--"),
                    "detail": lead.get("municipality", ""),
                    "tone": "default",
                },
            ],
            "items": [
                {
                    "title": row.get("stop_name", "Unknown"),
                    "detail": row.get("municipality", ""),
                    "meta": f"+{row.get('avg_delay_minutes', 0)} min",
                    "tone": "warning",
                }
                for row in hotspots
            ],
            "suggestions": [
                "Are there alerts causing those delays?",
                "How is weather affecting service?",
                "What's the best route from Back Bay to Harvard?",
            ],
        }

    route_or_mode = _detect_route_or_mode(message)
    if route_or_mode or any(
        term in lower for term in ["alert", "running normally", "detour", "service issue"]
    ):
        alerts = await bq.query_from_file(
            "alerts_active.sql",
            params={"severity": "all", "limit": "20"},
        )
        alerts_by_mode = await bq.query_from_file("alerts_by_mode.sql")

        filtered_alerts = alerts
        if route_or_mode:
            route_lower = route_or_mode.lower()
            filtered_alerts = [
                alert
                for alert in alerts
                if route_lower in str(alert.get("header", "")).lower()
                or route_lower in str(alert.get("service_effect", "")).lower()
                or route_lower in str(alert.get("affected_routes", "")).lower()
            ]

            if route_or_mode in {"Bus", "Heavy Rail", "Commuter Rail", "Ferry"}:
                filtered_alerts = [
                    alert
                    for alert in alerts
                    if route_or_mode.lower() in str(alert.get("header", "")).lower()
                    or route_or_mode.lower() in str(alert.get("service_effect", "")).lower()
                ] or filtered_alerts

        count = len(filtered_alerts)
        mode_row = None
        if route_or_mode in {"Bus", "Heavy Rail", "Commuter Rail", "Ferry"}:
            mode_row = next(
                (
                    row
                    for row in alerts_by_mode
                    if str(row.get("mode", "")).lower() == route_or_mode.lower()
                ),
                None,
            )

        subject = route_or_mode or "the network"
        normal_text = "running mostly normally" if count == 0 else "showing active disruptions"
        return {
            "kind": "alerts",
            "answer": (
                        f"{subject} is {normal_text}. "
                        f"I found {count} active alert{'s' if count != 1 else ''}."
                    ),
            "cards": [
                {
                    "title": "Active Alerts",
                    "value": str(count),
                    "detail": f"For {subject}",
                    "tone": "warning" if count else "positive",
                },
                {
                    "title": "Mode Total",
                    "value": str(mode_row.get("alert_count", count) if mode_row else count),
                    "detail": "Current count",
                    "tone": "default",
                },
            ],
            "items": [
                {
                    "title": alert.get("header", "Alert"),
                    "detail": alert.get("service_effect") or alert.get("effect", ""),
                    "meta": alert.get("severity_category", ""),
                    "tone": "warning",
                }
                for alert in filtered_alerts[:5]
            ],
            "suggestions": [
                "What are the biggest delays right now?",
                "How is weather affecting service?",
                "What's the best route from Back Bay to Harvard?",
            ],
        }

    system_rows = await bq.query_from_file("overview_system_enhanced.sql")
    alerts = await bq.query_from_file(
        "alerts_active.sql",
        params={"severity": "all", "limit": "3"},
    )
    system = system_rows[0] if system_rows else {}

    return {
        "kind": "overview",
        "answer": (
            f"Right now the MBTA is {system.get('on_time_pct', 0)}% on-time with "
            f"{system.get('active_alerts', 0)} active alerts and an average delay of "
            f"{system.get('avg_delay_minutes', 0)} minutes."
        ),
        "cards": [
            {
                "title": "On-Time Performance",
                "value": f"{system.get('on_time_pct', 0)}%",
                "detail": "System-wide",
                "tone": "positive",
            },
            {
                "title": "Avg Delay",
                "value": f"{system.get('avg_delay_minutes', 0)} min",
                "detail": "Across all modes",
                "tone": "warning",
            },
            {
                "title": "Active Alerts",
                "value": str(system.get("active_alerts", 0)),
                "detail": "Current service alerts",
                "tone": "warning" if system.get("active_alerts", 0) else "positive",
            },
        ],
        "items": [
            {
                "title": alert.get("header", "Alert"),
                "detail": alert.get("service_effect") or alert.get("effect", ""),
                "meta": alert.get("severity_category", ""),
                "tone": "warning",
            }
            for alert in alerts[:3]
        ],
        "suggestions": SUGGESTIONS,
    }
