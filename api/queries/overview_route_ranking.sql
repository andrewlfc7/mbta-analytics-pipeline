SELECT
  route_id,
  route_name,
  route_type_desc,
  total_predictions,
  ROUND(on_time_pct, 1) AS on_time_pct,
  ROUND(avg_delay_seconds / 60.0, 1) AS avg_delay_minutes,
  ROUND(reliability_score, 1) AS reliability_score
FROM `{project}.marts.mart_route_reliability`
ORDER BY reliability_score DESC
