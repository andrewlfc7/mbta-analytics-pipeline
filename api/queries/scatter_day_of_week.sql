SELECT
  CASE EXTRACT(DAYOFWEEK FROM service_date)
    WHEN 1 THEN 'Sunday'
    WHEN 2 THEN 'Monday'
    WHEN 3 THEN 'Tuesday'
    WHEN 4 THEN 'Wednesday'
    WHEN 5 THEN 'Thursday'
    WHEN 6 THEN 'Friday'
    WHEN 7 THEN 'Saturday'
  END AS day_of_week,
  route_id,
  ROUND(delay_seconds / 60.0, 1) AS delay_minutes,
  EXTRACT(HOUR FROM COALESCE(scheduled_arrival, scheduled_departure)) AS hour
FROM `{project}.intermediate.int_scheduled_vs_actual`
WHERE ('@route_filter' = 'all' OR route_id = '@route_filter')
ORDER BY RAND()
LIMIT @sample_size
