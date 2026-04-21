SELECT
  s.stop_name AS station_name,
  ROUND(s.avg_delay_seconds / 60.0, 1) AS avg_delay_minutes,
  s.total_predictions AS trip_count,
  ROUND(s.late_pct, 1) AS pct_late
FROM `{project}.marts.mart_stop_performance` s
WHERE s.stop_id IN (
  SELECT DISTINCT stop_id
  FROM `{project}.intermediate.int_scheduled_vs_actual`
  WHERE route_id = '@route_id'
)
ORDER BY s.avg_delay_seconds DESC
LIMIT 20
