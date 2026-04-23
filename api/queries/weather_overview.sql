SELECT
  weather_condition AS condition,
  ROUND(AVG(delay_seconds) / 60.0, 1) AS avg_delay_minutes,
  COUNT(*) AS trip_count,
  ROUND(SAFE_DIVIDE(COUNTIF(delay_seconds > 300), COUNT(*)) * 100, 1) AS pct_late,
  ROUND(AVG(temperature_f), 1) AS avg_temp,
  ROUND(AVG(wind_speed_mph), 1) AS avg_wind,
  ROUND(AVG(precipitation_mm), 2) AS avg_precip
FROM `{project}.intermediate.int_weather_transit`
WHERE weather_condition IS NOT NULL
GROUP BY weather_condition
ORDER BY avg_delay_minutes DESC
