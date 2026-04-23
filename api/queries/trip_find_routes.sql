WITH origin_routes AS (
  SELECT DISTINCT route_id, direction_id
  FROM `{project}.raw_mbta.raw_schedules`
  WHERE stop_id = '@origin_stop'
),
dest_routes AS (
  SELECT DISTINCT route_id, direction_id
  FROM `{project}.raw_mbta.raw_schedules`
  WHERE stop_id = '@dest_stop'
),
direct_routes AS (
  SELECT
    o.route_id,
    o.direction_id,
    r.long_name AS route_name,
    r.route_type,
    r.route_type_desc,
    COALESCE(r.color, '7F7F7F') AS route_color,
    'direct' AS connection_type,
    NULL AS transfer_stop,
    NULL AS transfer_route_id,
    NULL AS transfer_route_name
  FROM origin_routes o
  JOIN dest_routes d ON o.route_id = d.route_id
  JOIN `{project}.raw_mbta.raw_routes` r ON o.route_id = r.route_id
),
transfer_routes AS (
  SELECT DISTINCT
    o.route_id AS first_route_id,
    r1.long_name AS first_route_name,
    r1.route_type AS first_route_type,
    r1.route_type_desc AS first_route_type_desc,
    COALESCE(r1.color, '7F7F7F') AS first_route_color,
    d.route_id AS second_route_id,
    r2.long_name AS second_route_name,
    r2.route_type AS second_route_type,
    r2.route_type_desc AS second_route_type_desc,
    COALESCE(r2.color, '7F7F7F') AS second_route_color,
    t1.stop_id AS transfer_stop_id,
    s.name AS transfer_stop_name
  FROM origin_routes o
  JOIN `{project}.raw_mbta.raw_schedules` t1 ON o.route_id = t1.route_id
  JOIN `{project}.raw_mbta.raw_schedules` t2 ON t1.stop_id = t2.stop_id AND t1.route_id != t2.route_id
  JOIN dest_routes d ON t2.route_id = d.route_id
  JOIN `{project}.raw_mbta.raw_routes` r1 ON o.route_id = r1.route_id
  JOIN `{project}.raw_mbta.raw_routes` r2 ON d.route_id = r2.route_id
  JOIN `{project}.raw_mbta.raw_stops` s ON t1.stop_id = s.stop_id
  WHERE t1.stop_id != '@origin_stop' AND t1.stop_id != '@dest_stop'
  LIMIT 20
)
SELECT
  route_id AS first_route_id,
  route_name AS first_route_name,
  route_type AS first_route_type,
  route_type_desc AS first_route_type_desc,
  route_color AS first_route_color,
  NULL AS second_route_id,
  NULL AS second_route_name,
  NULL AS second_route_type,
  NULL AS second_route_type_desc,
  NULL AS second_route_color,
  NULL AS transfer_stop_id,
  NULL AS transfer_stop_name,
  'direct' AS connection_type,
  0 AS transfers
FROM direct_routes
UNION ALL
SELECT
  first_route_id,
  first_route_name,
  first_route_type,
  first_route_type_desc,
  first_route_color,
  second_route_id,
  second_route_name,
  second_route_type,
  second_route_type_desc,
  second_route_color,
  transfer_stop_id,
  transfer_stop_name,
  'transfer' AS connection_type,
  1 AS transfers
FROM transfer_routes
ORDER BY transfers, first_route_type
