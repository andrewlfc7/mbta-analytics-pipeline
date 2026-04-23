SELECT
  sp.stop_id,
  sp.stop_name,
  sp.municipality,
  sp.latitude,
  sp.longitude,
  sp.avg_delay_seconds,
  ROUND(sp.avg_delay_seconds / 60.0, 1) AS avg_delay_minutes,
  sp.late_pct,
  sp.routes_served,
  sp.delay_hotspot_score,
  COALESCE(aa.alert_count, 0) AS active_alert_count
FROM `{project}.marts.mart_stop_performance` sp
LEFT JOIN (
  SELECT
    stop_ref AS stop_id,
    COUNT(DISTINCT a.alert_id) AS alert_count
  FROM `{project}.marts.mart_alert_summary` a,
  UNNEST(IFNULL(
    REGEXP_EXTRACT_ALL(CAST(a.affected_stops AS STRING), r'[A-Za-z0-9\-]+'),
    ARRAY<STRING>[]
  )) AS stop_ref
  WHERE a.is_active = TRUE
  GROUP BY stop_ref
) aa ON sp.stop_id = aa.stop_id
WHERE sp.latitude IS NOT NULL
  AND sp.longitude IS NOT NULL
ORDER BY sp.delay_hotspot_score DESC