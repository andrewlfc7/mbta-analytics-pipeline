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
  sp.delay_hotspot_score,
  sp.total_vehicle_visits,
  sp.avg_occupancy_pct
FROM `{project}.marts.mart_stop_performance` sp
WHERE sp.total_predictions >= 5
  AND sp.latitude IS NOT NULL
ORDER BY @sort_by DESC
LIMIT @limit