WITH schedules AS (
  SELECT
    sch.*,
    DATE(
      CASE
        WHEN EXTRACT(HOUR FROM DATETIME(CAST(sch.departure_time AS TIMESTAMP), "America/New_York")) < 3
        THEN DATETIME_SUB(DATETIME(CAST(sch.departure_time AS TIMESTAMP), "America/New_York"), INTERVAL 1 DAY)
        ELSE DATETIME(CAST(sch.departure_time AS TIMESTAMP), "America/New_York")
      END
    ) AS service_date
  FROM `{project}.raw_mbta.raw_schedules` sch
  WHERE sch.departure_time IS NOT NULL
)
SELECT
  sch.route_id,
  r.long_name AS route_name,
  r.route_type_desc,
  r.route_type,
  COALESCE(r.color, '7F7F7F') AS route_color,
  r.sort_order,
  COUNT(*) AS total_stops,
  COUNT(DISTINCT sch.trip_id) AS total_trips,
  COUNT(DISTINCT sch.stop_id) AS unique_stops,
  MIN(sch.departure_time) AS first_departure,
  MAX(sch.departure_time) AS last_departure
FROM schedules sch
JOIN `{project}.raw_mbta.raw_routes` r
  ON sch.route_id = r.route_id
WHERE sch.service_date BETWEEN DATE('@start_date') AND DATE('@end_date')
GROUP BY sch.route_id, r.long_name, r.route_type_desc, r.route_type, r.color, r.sort_order
ORDER BY r.route_type, r.sort_order, sch.route_id