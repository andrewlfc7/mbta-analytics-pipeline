WITH station_delays AS (
  SELECT
    s.stop_id,
    s.stop_name,
    s.municipality,
    CAST(s.stop_lat AS FLOAT64) AS latitude,
    CAST(s.stop_lon AS FLOAT64) AS longitude,
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
  WHERE s.stop_lat IS NOT NULL
    AND s.stop_lon IS NOT NULL
  GROUP BY s.stop_id, s.stop_name, s.municipality, s.stop_lat, s.stop_lon
),
active_alerts AS (
  SELECT
    stop_ref AS stop_id,
    COUNT(DISTINCT alert_id) AS alert_count
  FROM `{project}.raw_mbta.raw_alerts` a
  CROSS JOIN UNNEST(
    IFNULL(
      JSON_EXTRACT_STRING_ARRAY(a.affected_stops),
      ARRAY<STRING>[]
    )
  ) AS stop_ref
  WHERE TIMESTAMP(a.active_start) <= CURRENT_TIMESTAMP()
    AND (a.active_end IS NULL OR TIMESTAMP(a.active_end) >= CURRENT_TIMESTAMP())
  GROUP BY stop_ref
)
SELECT
  sd.*,
  COALESCE(aa.alert_count, 0) AS active_alert_count
FROM station_delays sd
LEFT JOIN active_alerts aa ON sd.stop_id = aa.stop_id
ORDER BY sd.delay_hotspot_score DESC
