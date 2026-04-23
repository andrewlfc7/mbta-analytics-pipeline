SELECT
  hour_of_day AS hour,
  day_type,
  time_period,
  ROUND(AVG(avg_delay_seconds) / 60.0, 1) AS avg_delay_minutes,
  ROUND(AVG(median_delay_seconds) / 60.0, 1) AS median_delay_minutes,
  SUM(prediction_count) AS trip_count,
  ROUND(AVG(late_pct), 1) AS pct_late
FROM `{project}.marts.mart_delay_analysis`
WHERE
  ('@route_filter' = 'all' OR route_id = '@route_filter')
  AND ('@day_type' = 'all' OR day_type = '@day_type')
GROUP BY hour_of_day, day_type, time_period
ORDER BY hour_of_day
