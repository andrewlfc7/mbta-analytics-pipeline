SELECT
  weather_condition AS condition,
  ROUND(AVG(delay_seconds) / 60.0, 1) AS avg_delay_minutes,
  COUNT(*) AS trip_count,
  ROUND(COUNTIF(delay_seconds > 300) / COUNT(*) * 100, 1) AS pct_late
FROM `{project}.intermediate.int_weather_transit`
WHERE ('@route_filter' = 'all' OR route_id = '@route_filter')
  AND weather_condition IS NOT NULL
GROUP BY weather_condition
ORDER BY avg_delay_minutes DESC
