SELECT
  stop_id,
  stop_name,
  municipality,
  latitude,
  longitude,
  ROUND(avg_delay_seconds / 60.0, 1) AS avg_delay_minutes,
  ROUND(late_pct, 1) AS late_pct,
  ROUND(delay_hotspot_score, 2) AS delay_hotspot_score,
  routes_served,
  total_predictions
FROM `{project}.marts.mart_stop_performance`
WHERE latitude IS NOT NULL AND longitude IS NOT NULL
ORDER BY delay_hotspot_score DESC
