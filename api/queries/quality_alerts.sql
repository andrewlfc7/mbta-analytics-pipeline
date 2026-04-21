SELECT
  alert_id,
  header,
  cause,
  effect,
  severity_category,
  service_effect,
  ROUND(duration_hours, 1) AS duration_hours,
  affected_route_count,
  affected_stop_count,
  ROUND(impact_score, 2) AS impact_score,
  is_active,
  FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', created_at) AS created_at
FROM `{project}.marts.mart_alert_summary`
WHERE is_active = TRUE
ORDER BY impact_score DESC
LIMIT 50
