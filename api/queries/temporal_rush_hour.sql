SELECT
  time_period,
  ROUND(AVG(avg_delay_seconds) / 60.0, 1) AS avg_delay_minutes,
  ROUND(AVG(median_delay_seconds) / 60.0, 1) AS median_delay_minutes,
  SUM(prediction_count) AS trip_count,
  ROUND(AVG(on_time_pct), 1) AS on_time_pct,
  ROUND(AVG(late_pct), 1) AS pct_late
FROM `{project}.marts.mart_delay_analysis`
WHERE
  ('@route_filter' = 'all' OR route_id = '@route_filter')
  AND service_date >= DATE_SUB(CURRENT_DATE(), INTERVAL @period_days DAY)
GROUP BY time_period
ORDER BY
  CASE time_period
    WHEN 'AM_RUSH' THEN 1
    WHEN 'MIDDAY' THEN 2
    WHEN 'PM_RUSH' THEN 3
    WHEN 'EVENING' THEN 4
    WHEN 'NIGHT' THEN 5
    ELSE 6
  END
