SELECT
  stop_id,
  stop_name,
  municipality,
  latitude,
  longitude,
  total_predictions,
  routes_served,
  ROUND(avg_delay_seconds / 60.0, 1) AS avg_delay_minutes,
  ROUND(median_delay_seconds / 60.0, 1) AS median_delay_minutes,
  ROUND(late_pct, 1) AS late_pct,
  ROUND(significant_delay_pct, 1) AS significant_delay_pct,
  ROUND(p90_delay_seconds / 60.0, 1) AS p90_delay_minutes,
  ROUND(delay_hotspot_score, 2) AS delay_hotspot_score
FROM `{project}.marts.mart_stop_performance`
ORDER BY @sort_by DESC
LIMIT @limit
