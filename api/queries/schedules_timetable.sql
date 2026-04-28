WITH trip_stops AS (
  SELECT
    sch.trip_id,
    sch.stop_id,
    s.name AS stop_name,
    sch.stop_sequence,
    sch.direction_id,
    sch.arrival_time,
    sch.departure_time,
    DATE(
      CASE
        WHEN EXTRACT(HOUR FROM DATETIME(CAST(sch.departure_time AS TIMESTAMP), "America/New_York")) < 3
        THEN DATETIME_SUB(DATETIME(CAST(sch.departure_time AS TIMESTAMP), "America/New_York"), INTERVAL 1 DAY)
        ELSE DATETIME(CAST(sch.departure_time AS TIMESTAMP), "America/New_York")
      END
    ) AS service_date,
    sch.timepoint
  FROM `{project}.raw_mbta.raw_schedules` sch
  JOIN `{project}.raw_mbta.raw_stops` s
    ON sch.stop_id = s.stop_id
  WHERE sch.route_id = '@route_id'
    AND sch.direction_id = CAST('@direction_id' AS INT64)
    AND sch.departure_time IS NOT NULL
)
SELECT
  trip_id,
  stop_id,
  stop_name,
  stop_sequence,
  direction_id,
  arrival_time,
  departure_time,
  service_date,
  timepoint
FROM trip_stops
WHERE service_date BETWEEN DATE('@start_date') AND DATE('@end_date')
ORDER BY service_date, departure_time, stop_sequence
LIMIT 1000