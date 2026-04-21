SELECT
  route_id,
  route_name,
  route_type_desc,
  total_predictions,
  ROUND(on_time_pct, 1) AS on_time_pct,
  ROUND(avg_delay_seconds / 60.0, 1) AS avg_delay_minutes,
  ROUND(median_delay_seconds / 60.0, 1) AS median_delay_minutes,
  ROUND(p90_delay_seconds / 60.0, 1) AS p90_delay_minutes,
  ROUND(significant_delay_pct, 1) AS significant_delay_pct,
  ROUND(reliability_score, 1) AS reliability_score,
  early_count,
  on_time_strict_count,
  slightly_late_count,
  late_count,
  very_late_count
FROM `{project}.marts.mart_route_reliability`
ORDER BY reliability_score DESC
