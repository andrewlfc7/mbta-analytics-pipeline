SELECT
  route_id,
  route_name,
  ROUND(on_time_pct, 1) AS on_time_pct,
  ROUND(avg_delay_seconds / 60.0, 1) AS avg_delay_minutes,
  total_predictions
FROM `{project}.marts.mart_route_reliability`
ORDER BY route_id
