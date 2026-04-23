SELECT
  hour_of_day AS hour,
  ROUND(AVG(significant_delay_pct), 1) AS delay_probability,
  SUM(prediction_count) AS trip_count,
  ROUND(AVG(avg_delay_seconds) / 60.0, 1) AS avg_delay_minutes
FROM `{project}.marts.mart_delay_analysis`
WHERE
  ('@route_filter' = 'all' OR route_id = '@route_filter')
GROUP BY hour_of_day
ORDER BY hour_of_day
