WITH current_clock AS (
  SELECT
    DATE(
      CASE
        WHEN EXTRACT(HOUR FROM CURRENT_DATETIME("America/New_York")) < 3
        THEN DATETIME_SUB(CURRENT_DATETIME("America/New_York"), INTERVAL 1 DAY)
        ELSE CURRENT_DATETIME("America/New_York")
      END
    ) AS current_service_date,
    (
      CASE
        WHEN EXTRACT(HOUR FROM CURRENT_DATETIME("America/New_York")) < 3
        THEN EXTRACT(HOUR FROM CURRENT_DATETIME("America/New_York")) + 24
        ELSE EXTRACT(HOUR FROM CURRENT_DATETIME("America/New_York"))
      END
    ) * 3600
    + EXTRACT(MINUTE FROM CURRENT_DATETIME("America/New_York")) * 60
    + EXTRACT(SECOND FROM CURRENT_DATETIME("America/New_York")) AS current_service_seconds
),

schedule_base AS (
  SELECT
    sch.route_id,
    sch.trip_id,
    DATE(
      CASE
        WHEN EXTRACT(
          HOUR FROM DATETIME(CAST(sch.departure_time AS TIMESTAMP), "America/New_York")
        ) < 3
        THEN DATETIME_SUB(
          DATETIME(CAST(sch.departure_time AS TIMESTAMP), "America/New_York"),
          INTERVAL 1 DAY
        )
        ELSE DATETIME(CAST(sch.departure_time AS TIMESTAMP), "America/New_York")
      END
    ) AS service_date,
    (
      CASE
        WHEN EXTRACT(
          HOUR FROM DATETIME(CAST(sch.departure_time AS TIMESTAMP), "America/New_York")
        ) < 3
        THEN EXTRACT(
          HOUR FROM DATETIME(CAST(sch.departure_time AS TIMESTAMP), "America/New_York")
        ) + 24
        ELSE EXTRACT(
          HOUR FROM DATETIME(CAST(sch.departure_time AS TIMESTAMP), "America/New_York")
        )
      END
    ) * 3600
    + EXTRACT(
      MINUTE FROM DATETIME(CAST(sch.departure_time AS TIMESTAMP), "America/New_York")
    ) * 60
    + EXTRACT(
      SECOND FROM DATETIME(CAST(sch.departure_time AS TIMESTAMP), "America/New_York")
    ) AS service_seconds
  FROM `{project}.raw_mbta.raw_schedules` sch
  WHERE sch.departure_time IS NOT NULL
),

selected_service_day AS (
  SELECT MAX(service_date) AS service_date
  FROM schedule_base
  WHERE service_date <= (SELECT current_service_date FROM current_clock)
),

previous_service_day AS (
  SELECT MAX(service_date) AS service_date
  FROM schedule_base
  WHERE service_date < (SELECT service_date FROM selected_service_day)
),

scheduled_trips AS (
  SELECT
    COUNT(DISTINCT trip_id) AS total_trips
  FROM schedule_base
  WHERE service_date = (SELECT service_date FROM previous_service_day)
    AND service_seconds <= (SELECT current_service_seconds FROM current_clock)
),

performance AS (
  SELECT
    COUNT(*) AS prediction_events,
    COUNTIF(delay_category IN ('early', 'on_time')) AS on_time_events,
    AVG(delay_seconds) AS avg_delay_seconds
  FROM `{project}.intermediate.int_scheduled_vs_actual`
  WHERE service_date = (SELECT service_date FROM previous_service_day)
),

alert_stats AS (
  SELECT
    COUNTIF(is_active) AS active_alerts
  FROM `{project}.marts.mart_alert_summary`
)

SELECT
  st.total_trips,
  ROUND(SAFE_DIVIDE(p.on_time_events * 100.0, p.prediction_events), 1) AS on_time_pct,
  ROUND(p.avg_delay_seconds / 60.0, 1) AS avg_delay_minutes,
  a.active_alerts,
  FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', CURRENT_TIMESTAMP()) AS last_updated
FROM scheduled_trips st
CROSS JOIN performance p
CROSS JOIN alert_stats a
