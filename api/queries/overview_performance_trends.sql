SELECT
  hour_of_day,
  route_type_desc AS mode,
  SUM(prediction_count) AS trips,
  ROUND(
    SAFE_DIVIDE(
      SUM(prediction_count * on_time_pct),
      SUM(prediction_count)
    ), 1
  ) AS on_time_pct,
  ROUND(
    SAFE_DIVIDE(
      SUM(prediction_count * avg_delay_seconds),
      SUM(prediction_count)
    ) / 60.0, 1
  ) AS avg_delay_minutes
FROM `{project}.marts.mart_delay_analysis`
WHERE day_type = '@day_type'
GROUP BY hour_of_day, route_type_desc
ORDER BY hour_of_day, route_type_desc