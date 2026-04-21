SELECT
  'mart_delay_analysis' AS table_name,
  COUNT(*) AS row_count,
  COUNT(DISTINCT route_id) AS unique_routes
FROM `{project}.marts.mart_delay_analysis`

UNION ALL

SELECT
  'mart_route_reliability',
  COUNT(*),
  COUNT(DISTINCT route_id)
FROM `{project}.marts.mart_route_reliability`

UNION ALL

SELECT
  'mart_stop_performance',
  COUNT(*),
  0
FROM `{project}.marts.mart_stop_performance`

UNION ALL

SELECT
  'mart_alert_summary',
  COUNT(*),
  0
FROM `{project}.marts.mart_alert_summary`
