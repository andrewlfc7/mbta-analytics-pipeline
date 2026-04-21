SELECT
  weather_condition AS condition,
  CASE EXTRACT(DAYOFWEEK FROM COALESCE(predicted_arrival, predicted_departure))
    WHEN 1 THEN 'Sunday'
    WHEN 2 THEN 'Monday'
    WHEN 3 THEN 'Tuesday'
    WHEN 4 THEN 'Wednesday'
    WHEN 5 THEN 'Thursday'
    WHEN 6 THEN 'Friday'
    WHEN 7 THEN 'Saturday'
  END AS day_of_week,
  ROUND(AVG(delay_seconds) / 60.0, 1) AS avg_delay_minutes,
  COUNT(*) AS trip_count
FROM `{project}.intermediate.int_weather_transit`
WHERE ('@route_filter' = 'all' OR route_id = '@route_filter')
  AND weather_condition IS NOT NULL
GROUP BY weather_condition, day_of_week
ORDER BY condition, day_of_week
