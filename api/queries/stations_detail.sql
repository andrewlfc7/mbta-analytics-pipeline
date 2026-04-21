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
  total_vehicle_visits,
  ROUND(avg_occupancy_pct, 1) AS avg_occupancy_pct,
  ROUND(peak_occupancy_pct, 1) AS peak_occupancy_pct,
  ROUND(delay_hotspot_score, 2) AS delay_hotspot_score
FROM `{project}.marts.mart_stop_performance`
WHERE stop_id = '@stop_id'
