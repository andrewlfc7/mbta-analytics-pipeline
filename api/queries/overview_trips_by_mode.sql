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
)

SELECT
  r.route_type_desc AS mode,
  COUNT(DISTINCT s.trip_id) AS trips
FROM schedule_base s
JOIN `{project}.raw_mbta.raw_routes` r
  ON s.route_id = r.route_id
WHERE s.service_date = (SELECT service_date FROM selected_service_day)
  AND s.service_seconds <= (SELECT current_service_seconds FROM current_clock)
GROUP BY r.route_type_desc
ORDER BY trips DESC
