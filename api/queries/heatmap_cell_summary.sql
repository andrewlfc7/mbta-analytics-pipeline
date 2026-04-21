SELECT
  ROUND(AVG(avg_delay_seconds) / 60.0, 1) AS avg_delay_minutes,
  ROUND(AVG(median_delay_seconds) / 60.0, 1) AS median_delay_minutes,
  SUM(prediction_count) AS trip_count,
  ROUND(AVG(late_pct), 1) AS pct_late
FROM `{project}.marts.mart_delay_analysis`
WHERE route_id = '@route_id'
  AND day_of_week = CAST('@day_of_week_num' AS INT64)
  AND hour_of_day = @hour
