SELECT
  sch.route_id,
  r.long_name AS route_name,
  r.route_type_desc,
  COALESCE(r.color, '7F7F7F') AS route_color,
  COUNT(*) AS total_stops,
  COUNT(DISTINCT sch.trip_id) AS total_trips,
  COUNT(DISTINCT sch.stop_id) AS unique_stops,
  MIN(sch.departure_time) AS first_departure,
  MAX(sch.departure_time) AS last_departure
FROM `{project}.raw_mbta.raw_schedules` sch
JOIN `{project}.raw_mbta.raw_routes` r ON sch.route_id = r.route_id
WHERE sch.departure_time IS NOT NULL
GROUP BY sch.route_id, r.long_name, r.route_type_desc, r.color
ORDER BY r.route_type, r.sort_order, sch.route_id
