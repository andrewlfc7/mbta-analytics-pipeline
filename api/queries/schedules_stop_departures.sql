WITH departures AS (
  SELECT
    sch.route_id,
    r.long_name AS route_name,
    COALESCE(r.color, '7F7F7F') AS route_color,
    r.route_type_desc,
    sch.trip_id,
    sch.departure_time,
    DATE(
      CASE
        WHEN EXTRACT(HOUR FROM DATETIME(CAST(sch.departure_time AS TIMESTAMP), "America/New_York")) < 3
        THEN DATETIME_SUB(DATETIME(CAST(sch.departure_time AS TIMESTAMP), "America/New_York"), INTERVAL 1 DAY)
        ELSE DATETIME(CAST(sch.departure_time AS TIMESTAMP), "America/New_York")
      END
    ) AS service_date,
    sch.direction_id,
    sch.stop_headsign
  FROM `{project}.raw_mbta.raw_schedules` sch
  JOIN `{project}.raw_mbta.raw_routes` r
    ON sch.route_id = r.route_id
  WHERE sch.stop_id = '@stop_id'
    AND sch.departure_time IS NOT NULL
)
SELECT *
FROM departures
WHERE service_date BETWEEN DATE('@start_date') AND DATE('@end_date')
ORDER BY service_date, departure_time
LIMIT 300