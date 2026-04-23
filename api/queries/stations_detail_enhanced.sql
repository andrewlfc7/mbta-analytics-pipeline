WITH station AS (
  SELECT
    sp.stop_id,
    sp.stop_name,
    sp.municipality,
    sp.latitude,
    sp.longitude,
    sp.total_predictions,
    sp.routes_served,
    sp.avg_delay_seconds,
    ROUND(sp.avg_delay_seconds / 60.0, 1) AS avg_delay_minutes,
    ROUND(100.0 - sp.late_pct, 1) AS on_time_pct,
    sp.late_pct,
    sp.significant_delay_pct,
    sp.p90_delay_seconds,
    ROUND(sp.p90_delay_seconds / 60.0, 1) AS p90_delay_minutes,
    sp.delay_hotspot_score,
    sp.total_vehicle_visits,
    sp.avg_occupancy_pct,
    sp.peak_occupancy_pct
  FROM `{project}.marts.mart_stop_performance` sp
  WHERE sp.stop_id = '@stop_id'
),
station_routes AS (
  SELECT DISTINCT
    sch.route_id,
    r.route_name,
    r.route_type_desc,
    r.route_color
  FROM `{project}.raw_mbta.raw_schedules` sch
  JOIN `{project}.raw_mbta.raw_routes` r ON sch.route_id = r.route_id
  WHERE sch.stop_id = '@stop_id'
),
station_alerts AS (
  SELECT
    a.alert_id,
    a.header,
    a.severity_category,
    a.effect,
    a.impact_score
  FROM `{project}.marts.mart_alert_summary` a,
  UNNEST(IFNULL(
    REGEXP_EXTRACT_ALL(CAST(a.affected_stops AS STRING), r'[A-Za-z0-9\-]+'),
    ARRAY<STRING>[]
  )) AS stop_ref
  WHERE a.is_active = TRUE
    AND stop_ref = '@stop_id'
)
SELECT
  s.*,
  ARRAY(SELECT AS STRUCT route_id, route_name, route_type_desc, route_color FROM station_routes) AS routes,
  ARRAY(SELECT AS STRUCT alert_id, header, severity_category, effect, impact_score FROM station_alerts) AS active_alerts
FROM station s