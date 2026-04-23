SELECT
  stop_id,
  name AS stop_name,
  municipality,
  latitude,
  longitude,
  location_type_desc
FROM `{project}.raw_mbta.raw_stops`
WHERE latitude IS NOT NULL
  AND LOWER(name) LIKE CONCAT('%', LOWER('@query'), '%')
  AND location_type IN (0, 1)
ORDER BY
  CASE WHEN location_type = 1 THEN 0 ELSE 1 END,
  CASE WHEN LOWER(name) = LOWER('@query') THEN 0
       WHEN LOWER(name) LIKE CONCAT(LOWER('@query'), '%') THEN 1
       ELSE 2 END,
  name
LIMIT 15
