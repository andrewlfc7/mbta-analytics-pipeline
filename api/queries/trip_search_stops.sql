SELECT
  stop_id,
  name AS stop_name,
  municipality,
  latitude,
  longitude,
  location_type_desc
FROM `{project}.raw_mbta.raw_stops`
WHERE location_type IN (0, 1)
  AND latitude IS NOT NULL
  AND LOWER(name) LIKE CONCAT('%', LOWER('@query'), '%')
ORDER BY
  CASE WHEN location_type = 1 THEN 0 ELSE 1 END,
  name
LIMIT 20
