WITH current_service_day AS (
  SELECT
    DATE(
      CASE
        WHEN EXTRACT(HOUR FROM CURRENT_DATETIME("America/New_York")) < 3
        THEN DATETIME_SUB(CURRENT_DATETIME("America/New_York"), INTERVAL 1 DAY)
        ELSE CURRENT_DATETIME("America/New_York")
      END
    ) AS service_date
)

SELECT
  route_type_desc AS mode,
  COUNT(DISTINCT trip_id) AS trips
FROM `{project}.intermediate.int_scheduled_vs_actual`
WHERE service_date = (SELECT service_date FROM current_service_day)
GROUP BY route_type_desc
ORDER BY trips DESC
