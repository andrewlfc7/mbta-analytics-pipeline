SELECT
  stop_id,
  stop_name,
  municipality,
  latitude,
  longitude,
  avg_delay_seconds,
  ROUND(avg_delay_seconds / 60.0, 1) AS avg_delay_minutes,
  late_pct,
  routes_served,
  delay_hotspot_score
FROM `{project}.marts.mart_stop_performance`
WHERE avg_delay_seconds IS NOT NULL
ORDER BY delay_hotspot_score DESC
LIMIT @limit