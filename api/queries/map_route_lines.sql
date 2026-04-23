WITH ordered_stops AS (
  SELECT
    sch.route_id,
    r.route_type,
    r.route_type_desc,
    COALESCE(r.route_color, '7F7F7F') AS route_color,
    s.stop_id,
    s.stop_name,
    CAST(s.stop_lat AS FLOAT64) AS latitude,
    CAST(s.stop_lon AS FLOAT64) AS longitude,
    MIN(sch.stop_sequence) AS stop_sequence
  FROM `{project}.raw_mbta.raw_schedules` sch
  JOIN `{project}.raw_mbta.raw_stops` s ON sch.stop_id = s.stop_id
  JOIN `{project}.raw_mbta.raw_routes` r ON sch.route_id = r.route_id
  WHERE s.stop_lat IS NOT NULL
    AND s.stop_lon IS NOT NULL
    AND sch.direction_id = 0
    -- Focus on rail + ferry for map legibility (bus would be too noisy)
    AND r.route_type IN (0, 1, 2, 4)
  GROUP BY sch.route_id, r.route_type, r.route_type_desc, r.route_color,
           s.stop_id, s.stop_name, s.stop_lat, s.stop_lon
)
SELECT * FROM ordered_stops
ORDER BY route_id, stop_sequence