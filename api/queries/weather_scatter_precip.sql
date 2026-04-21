SELECT
  ROUND(precipitation_mm, 1) AS precipitation_mm,
  ROUND(AVG(delay_seconds) / 60.0, 1) AS avg_delay_minutes,
  COUNT(*) AS trip_count,
  weather_condition
FROM `{project}.intermediate.int_weather_transit`
WHERE ('@route_filter' = 'all' OR route_id = '@route_filter')
  AND precipitation_mm > 0
  AND (
    '@precip_type' = 'all'
    OR ('@precip_type' = 'rain' AND is_snow = FALSE)
    OR ('@precip_type' = 'snow' AND is_snow = TRUE)
  )
GROUP BY ROUND(precipitation_mm, 1), weather_condition
ORDER BY precipitation_mm
