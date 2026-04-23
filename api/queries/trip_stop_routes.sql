SELECT DISTINCT
  sch.route_id,
  r.long_name AS route_name,
  r.route_type,
  r.route_type_desc,
  COALESCE(r.color, '7F7F7F') AS route_color,
  sch.direction_id
FROM `{project}.raw_mbta.raw_schedules` sch
JOIN `{project}.raw_mbta.raw_routes` r ON sch.route_id = r.route_id
WHERE sch.stop_id = '@stop_id'
ORDER BY r.route_type, sch.route_id
