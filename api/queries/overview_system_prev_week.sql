SELECT
  ROUND(AVG(on_time_pct), 1) AS on_time_pct,
  ROUND(AVG(avg_delay_seconds) / 60.0, 1) AS avg_delay_minutes,
  SUM(prediction_count) AS total_trips,
  0 AS active_alerts
FROM `{project}.marts.mart_delay_analysis`
