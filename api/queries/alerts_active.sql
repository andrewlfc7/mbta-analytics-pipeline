SELECT
  alert_id,
  cause,
  effect,
  severity,
  severity_category,
  header,
  service_effect,
  is_active,
  active_start,
  active_end,
  duration_hours,
  affected_routes,
  affected_stops,
  affected_route_count,
  affected_stop_count,
  impact_score,
  created_at,
  updated_at
FROM `{project}.marts.mart_alert_summary`
WHERE is_active = TRUE
  AND (
    '@severity' = 'all'
    OR LOWER(severity_category) = LOWER('@severity')
  )
ORDER BY impact_score DESC
LIMIT @limit