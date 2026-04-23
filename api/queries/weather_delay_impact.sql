WITH weather_bins AS (
  SELECT
    wt.route_id,
    wt.delay_seconds,
    wt.temperature_f,
    wt.wind_speed_mph,
    wt.precipitation_mm,
    wt.weather_condition,
    CASE
      WHEN wt.is_precipitation = TRUE THEN 'Precipitation'
      WHEN wt.is_high_wind = TRUE THEN 'High Wind'
      WHEN wt.temperature_f < 32 THEN 'Freezing'
      WHEN wt.temperature_f > 90 THEN 'Extreme Heat'
      WHEN wt.is_low_visibility = TRUE THEN 'Low Visibility'
      ELSE 'Normal'
    END AS condition_category
  FROM `{project}.intermediate.int_weather_transit` wt
  WHERE wt.delay_seconds IS NOT NULL
)
SELECT
  condition_category,
  COUNT(*) AS observation_count,
  ROUND(AVG(delay_seconds) / 60.0, 1) AS avg_delay_minutes,
  COUNT(DISTINCT route_id) AS routes_affected,
  ROUND(AVG(temperature_f), 1) AS avg_temp,
  ROUND(AVG(wind_speed_mph), 1) AS avg_wind,
  ROUND(AVG(precipitation_mm), 2) AS avg_precip
FROM weather_bins
GROUP BY condition_category
ORDER BY avg_delay_minutes DESC
