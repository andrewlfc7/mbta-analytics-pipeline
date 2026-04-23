WITH alert_route_ids AS (
  SELECT
    a.alert_id,
    a.severity,
    a.header,
    a.effect,
    a.is_active,
    a.impact_score,
    rid
  FROM `{project}.marts.mart_alert_summary` a,
  UNNEST(IFNULL(
    REGEXP_EXTRACT_ALL(CAST(a.affected_routes AS STRING), r'[A-Za-z0-9\-]+'),
    ARRAY<STRING>[]
  )) AS rid
  WHERE a.is_active = TRUE
),
alert_with_mode AS (
  SELECT
    ar.alert_id,
    COALESCE(r.route_type_desc, 'Unknown') AS mode
  FROM alert_route_ids ar
  LEFT JOIN `{project}.raw_mbta.raw_routes` r ON ar.rid = r.route_id
)
SELECT
  mode,
  COUNT(DISTINCT alert_id) AS alert_count
FROM alert_with_mode
GROUP BY mode
ORDER BY alert_count DESC