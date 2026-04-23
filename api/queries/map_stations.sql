WITH station_delays AS (
  SELECT
    s.stop_id,
    s.name AS stop_name,
    s.municipality,
    s.latitude,
    s.longitude,
    ROUND(AVG(sa.delay_seconds), 1) AS avg_delay_seconds,
    ROUND(AVG(sa.delay_seconds) / 60.0, 1) AS avg_delay_minutes,
    ROUND(SAFE_DIVIDE(
      COUNTIF(sa.delay_seconds > 120),
      COUNT(*)
    ) * 100, 1) AS late_pct,
    COUNT(DISTINCT sa.route_id) AS routes_served,
    ROUND(
      AVG(sa.delay_seconds) / 60.0 * 0.4
      + SAFE_DIVIDE(COUNTIF(sa.delay_seconds > 120), COUNT(*)) * 100 * 0.3
      + COUNT(DISTINCT sa.route_id) * 0.3,
      1
    ) AS delay_hotspot_score
  FROM `{project}.raw_mbta.raw_stops` s
  JOIN `{project}.intermediate.int_scheduled_vs_actual` sa ON s.stop_id = sa.stop_id
  WHERE s.latitude IS NOT NULL
    AND s.longitude IS NOT NULL
  GROUP BY s.stop_id, s.name, s.municipality, s.latitude, s.longitude
),
active_alerts AS (
  SELECT
    stop_ref.element AS stop_id,
    COUNT(DISTINCT a.alert_id) AS alert_count
  FROM `{project}.raw_mbta.raw_alerts` a,
  UNNEST(a.affected_stops.list) AS stop_ref
  WHERE TIMESTAMP(a.active_start) <= CURRENT_TIMESTAMP()
    AND (a.active_end IS NULL OR TIMESTAMP(a.active_end) >= CURRENT_TIMESTAMP())
  GROUP BY stop_ref.element
)
SELECT
  sd.*,
  COALESCE(aa.alert_count, 0) AS active_alert_count
FROM station_delays sd
LEFT JOIN active_alerts aa ON sd.stop_id = aa.stop_id
ORDER BY sd.delay_hotspot_score DESC
