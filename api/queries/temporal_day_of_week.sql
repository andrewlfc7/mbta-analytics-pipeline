SELECT
  CASE day_of_week
    WHEN 1 THEN 'Sunday'
    WHEN 2 THEN 'Monday'
    WHEN 3 THEN 'Tuesday'
    WHEN 4 THEN 'Wednesday'
    WHEN 5 THEN 'Thursday'
    WHEN 6 THEN 'Friday'
    WHEN 7 THEN 'Saturday'
  END AS day_of_week,
  day_of_week AS day_num,
  ROUND(AVG(avg_delay_seconds) / 60.0, 1) AS avg_delay_minutes,
  ROUND(AVG(median_delay_seconds) / 60.0, 1) AS median_delay_minutes,
  SUM(prediction_count) AS trip_count,
  ROUND(AVG(late_pct), 1) AS pct_late
FROM `{project}.marts.mart_delay_analysis`
WHERE ('@route_filter' = 'all' OR route_id = '@route_filter')
GROUP BY 1, 2
ORDER BY day_num
