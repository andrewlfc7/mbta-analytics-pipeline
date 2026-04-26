WITH active_alerts AS (
  SELECT
    stop_id,
    COUNT(DISTINCT alert_id) AS alert_count
  FROM (
    SELECT
      mas.alert_id,
      stop_id
    FROM `{project}.marts.mart_alert_summary` mas,
    UNNEST(mas.affected_stops) AS stop_id
    WHERE mas.is_active = TRUE
  )
  GROUP BY stop_id
)
SELECT
  sp.stop_id,
  sp.stop_name,
  sp.municipality,
  sp.latitude,
  sp.longitude,
  ROUND(sp.avg_delay_seconds, 1) AS avg_delay_seconds,
  ROUND(sp.avg_delay_seconds / 60.0, 1) AS avg_delay_minutes,
  ROUND(sp.late_pct, 1) AS late_pct,
  sp.routes_served,
  ROUND(sp.delay_hotspot_score, 1) AS delay_hotspot_score,
  COALESCE(aa.alert_count, 0) AS active_alert_count
FROM `{project}.marts.mart_stop_performance` sp
LEFT JOIN active_alerts aa ON sp.stop_id = aa.stop_id
WHERE sp.total_predictions >= 5
  AND sp.latitude IS NOT NULL
  AND sp.longitude IS NOT NULL
ORDER BY sp.delay_hotspot_score DESC
