SELECT
  CAST(service_date AS STRING) AS date,
  ROUND(AVG(delay_seconds) / 60.0, 1) AS avg_delay_minutes
FROM `{project}.intermediate.int_scheduled_vs_actual`
WHERE route_id = '@route_id'
  AND EXTRACT(HOUR FROM COALESCE(scheduled_arrival, scheduled_departure)) = @hour
GROUP BY service_date
ORDER BY service_date DESC
LIMIT 30
