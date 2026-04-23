WITH weather_bins AS (
  SELECT
    wt.route_id,
    wt.route_name,
    r.route_type_desc,
    wt.avg_delay_seconds,
    wt.prediction_count,
    wt.temperature_2m,
    wt.wind_speed_10m,
    wt.precipitation,
    CASE
      WHEN wt.precipitation > 0.1 THEN 'Rain'
      WHEN wt.wind_speed_10m > 15 THEN 'High Wind'
      WHEN wt.temperature_2m < 32 THEN 'Freezing'
      WHEN wt.temperature_2m > 90 THEN 'Extreme Heat'
      ELSE 'Normal'
    END AS weather_condition
  FROM `{project}.intermediate.int_weather_transit` wt
  JOIN `{project}.raw_mbta.raw_routes` r ON wt.route_id = r.route_id
  WHERE wt.prediction_count >= 3
)
SELECT
  weather_condition,
  COUNT(*) AS observation_count,
  ROUND(AVG(avg_delay_seconds) / 60.0, 1) AS avg_delay_minutes,
  ROUND(AVG(prediction_count), 0) AS avg_trips,
  ROUND(AVG(temperature_2m), 1) AS avg_temp,
  ROUND(AVG(wind_speed_10m), 1) AS avg_wind,
  ROUND(AVG(precipitation), 2) AS avg_precip
FROM weather_bins
GROUP BY weather_condition
ORDER BY avg_delay_minutes DESC