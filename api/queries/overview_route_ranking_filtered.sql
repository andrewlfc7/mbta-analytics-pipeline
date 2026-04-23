SELECT
  route_id,
  route_name,
  route_type,
  route_type_desc,
  total_predictions,
  on_time_pct,
  ROUND(avg_delay_seconds / 60.0, 1) AS avg_delay_minutes,
  reliability_score
FROM `{project}.marts.mart_route_reliability`
WHERE 1=1
  AND (
    '@mode' = 'all'
    OR LOWER(REPLACE(route_type_desc, ' ', '_')) = LOWER('@mode')
  )
ORDER BY on_time_pct DESC
LIMIT @limit