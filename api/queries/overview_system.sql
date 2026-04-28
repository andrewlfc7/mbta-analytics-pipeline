WITH current_service_day AS (
  SELECT
    DATE(
      CASE
        WHEN EXTRACT(HOUR FROM CURRENT_DATETIME("America/New_York")) < 3
        THEN DATETIME_SUB(CURRENT_DATETIME("America/New_York"), INTERVAL 1 DAY)
        ELSE CURRENT_DATETIME("America/New_York")
      END
    ) AS service_date
),

today AS (
  SELECT
    COUNT(*) AS prediction_events,
    COUNT(DISTINCT trip_id) AS total_trips,
    COUNTIF(delay_category IN ('early', 'on_time')) AS on_time_events,
    AVG(delay_seconds) AS avg_delay_seconds
  FROM `{project}.intermediate.int_scheduled_vs_actual`
  WHERE service_date = (SELECT service_date FROM current_service_day)
)

SELECT
  ROUND(SAFE_DIVIDE(on_time_events * 100.0, prediction_events), 1) AS on_time_pct,
  ROUND(avg_delay_seconds / 60.0, 1) AS avg_delay_minutes,
  total_trips,
  (
    SELECT COUNT(*)
    FROM `{project}.marts.mart_alert_summary`
    WHERE is_active = TRUE
  ) AS active_alerts,
  FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', CURRENT_TIMESTAMP()) AS last_updated
FROM today
