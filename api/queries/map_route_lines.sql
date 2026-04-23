WITH ordered_stops AS (
  SELECT
    sch.route_id,
    r.route_type,
    r.route_type_desc,
    COALESCE(r.color, '7F7F7F') AS route_color,
    s.stop_id,
    s.name AS stop_name,
    s.latitude,
    s.longitude,
    MIN(sch.stop_sequence) AS stop_sequence
  FROM `{project}.raw_mbta.raw_schedules` sch
  JOIN `{project}.raw_mbta.raw_stops` s ON sch.stop_id = s.stop_id
  JOIN `{project}.raw_mbta.raw_routes` r ON sch.route_id = r.route_id
  WHERE s.latitude IS NOT NULL
    AND s.longitude IS NOT NULL
    AND sch.direction_id = 0
    AND r.route_type IN (0, 1, 2, 4)
  GROUP BY sch.route_id, r.route_type, r.route_type_desc, r.color,
           s.stop_id, s.name, s.latitude, s.longitude
)
SELECT * FROM ordered_stops
ORDER BY route_id, stop_sequence
