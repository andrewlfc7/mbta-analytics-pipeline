WITH alert_routes AS (
  SELECT
    a.alert_id,
    route_ref.element AS route_id
  FROM `{project}.raw_mbta.raw_alerts` a,
  UNNEST(a.affected_routes.list) AS route_ref
  WHERE TIMESTAMP(a.active_start) <= CURRENT_TIMESTAMP()
    AND (a.active_end IS NULL OR TIMESTAMP(a.active_end) >= CURRENT_TIMESTAMP())
),
alert_with_mode AS (
  SELECT
    ar.alert_id,
    COALESCE(r.route_type_desc, 'Unknown') AS mode
  FROM alert_routes ar
  LEFT JOIN `{project}.raw_mbta.raw_routes` r ON ar.route_id = r.route_id
)
SELECT
  mode,
  COUNT(DISTINCT alert_id) AS alert_count
FROM alert_with_mode
GROUP BY mode
ORDER BY alert_count DESC
