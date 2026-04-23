SELECT
  temperature_2m AS temp_f,
  relative_humidity_2m AS humidity,
  wind_speed_10m AS wind_mph,
  precipitation AS precip_in,
  weather_code,
  CASE
    WHEN weather_code IN (0, 1) THEN 'Clear'
    WHEN weather_code IN (2, 3) THEN 'Cloudy'
    WHEN weather_code IN (45, 48) THEN 'Fog'
    WHEN weather_code IN (51, 53, 55, 56, 57) THEN 'Drizzle'
    WHEN weather_code IN (61, 63, 65, 66, 67) THEN 'Rain'
    WHEN weather_code IN (71, 73, 75, 77) THEN 'Snow'
    WHEN weather_code IN (80, 81, 82) THEN 'Rain Showers'
    WHEN weather_code IN (85, 86) THEN 'Snow Showers'
    WHEN weather_code IN (95, 96, 99) THEN 'Thunderstorm'
    ELSE 'Unknown'
  END AS condition,
  timestamp
FROM `{project}.raw_mbta.raw_weather`
ORDER BY timestamp DESC
LIMIT 1
