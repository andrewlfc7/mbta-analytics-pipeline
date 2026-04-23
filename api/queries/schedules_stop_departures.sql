SELECT
  sch.route_id,
  r.long_name AS route_name,
  COALESCE(r.color, '7F7F7F') AS route_color,
  r.route_type_desc,
  sch.trip_id,
  sch.departure_time,
  sch.direction_id,
  sch.stop_headsign
FROM `{project}.raw_mbta.raw_schedules` sch
JOIN `{project}.raw_mbta.raw_routes` r ON sch.route_id = r.route_id
WHERE sch.stop_id = '@stop_id'
  AND sch.departure_time IS NOT NULL
ORDER BY sch.departure_time
LIMIT 50
