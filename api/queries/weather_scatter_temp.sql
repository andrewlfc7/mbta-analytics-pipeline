SELECT
  ROUND(temperature_f, 0) AS temperature_f,
  ROUND(AVG(delay_seconds) / 60.0, 1) AS avg_delay_minutes,
  COUNT(*) AS trip_count
FROM `{project}.intermediate.int_weather_transit`
WHERE ('@route_filter' = 'all' OR route_id = '@route_filter')
  AND temperature_f IS NOT NULL
GROUP BY ROUND(temperature_f, 0)
ORDER BY temperature_f
