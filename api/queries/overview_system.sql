SELECT
  ROUND(AVG(on_time_pct), 1) AS on_time_pct,
  ROUND(AVG(avg_delay_seconds) / 60.0, 1) AS avg_delay_minutes,
  SUM(prediction_count) AS total_trips,
  (SELECT COUNT(*) FROM `{project}.marts.mart_alert_summary` WHERE is_active = TRUE) AS active_alerts,
  FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', CURRENT_TIMESTAMP()) AS last_updated
FROM `{project}.marts.mart_delay_analysis`
