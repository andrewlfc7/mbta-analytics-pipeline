SELECT
  ROUND(wind_speed_mph, 0) AS wind_speed_mph,
  route_id,
  ROUND(AVG(delay_seconds) / 60.0, 1) AS avg_delay_minutes,
  COUNT(*) AS trip_count
FROM `{project}.intermediate.int_weather_transit`
WHERE ('@route_filter' = 'all' OR route_id = '@route_filter')
  AND wind_speed_mph IS NOT NULL
GROUP BY ROUND(wind_speed_mph, 0), route_id
ORDER BY wind_speed_mph
