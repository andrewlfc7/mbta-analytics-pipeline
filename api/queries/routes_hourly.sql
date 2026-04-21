SELECT
  hour_of_day AS hour,
  time_period,
  ROUND(AVG(avg_delay_seconds) / 60.0, 1) AS avg_delay_minutes,
  SUM(prediction_count) AS trip_count,
  ROUND(AVG(on_time_pct), 1) AS on_time_pct,
  ROUND(AVG(late_pct), 1) AS pct_late
FROM `{project}.marts.mart_delay_analysis`
WHERE route_id = '@route_id'
GROUP BY hour_of_day, time_period
ORDER BY hour_of_day
