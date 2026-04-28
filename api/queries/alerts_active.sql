WITH latest_alerts AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY alert_id
      ORDER BY updated_at DESC, extracted_at DESC
    ) AS rn
  FROM `{project}.staging.stg_alerts`
),

cleaned AS (
  SELECT
    alert_id,
    cause,
    effect,
    severity,
    CASE
      WHEN severity >= 7 THEN 'critical'
      WHEN severity >= 4 THEN 'major'
      WHEN severity >= 1 THEN 'minor'
      ELSE 'info'
    END AS severity_category,
    header,
    service_effect,

    -- active if lifecycle says active and current timestamp is inside the alert window
    lifecycle,
    active_start,
    active_end,
    duration_certainty,
    affected_routes,
    affected_stops,
    ARRAY_LENGTH(affected_routes) AS affected_route_count,
    ARRAY_LENGTH(affected_stops) AS affected_stop_count,
    created_at,
    updated_at,
    closed_timestamp,

    -- simple impact score for ordering
    (
      COALESCE(severity, 0) * 5
      + ARRAY_LENGTH(affected_routes) * 2
      + ARRAY_LENGTH(affected_stops) * 0.25
    ) AS impact_score
  FROM latest_alerts
  WHERE rn = 1
),

active_now AS (
  SELECT *
  FROM cleaned
  WHERE LOWER(COALESCE(lifecycle, '')) NOT IN ('deleted', 'ended')
    AND closed_timestamp IS NULL
    AND (
      active_start IS NULL
      OR active_start <= CURRENT_TIMESTAMP()
    )
    AND (
      active_end IS NULL
      OR active_end > CURRENT_TIMESTAMP()
    )
)

SELECT
  alert_id,
  cause,
  effect,
  severity,
  severity_category,
  header,
  service_effect,
  TRUE AS is_active,
  active_start,
  active_end,
  affected_routes,
  affected_stops,
  affected_route_count,
  affected_stop_count,
  impact_score,
  created_at,
  updated_at
FROM active_now
WHERE (
  '@severity' = 'all'
  OR '@severity' = ''
  OR LOWER(severity_category) = LOWER('@severity')
)
ORDER BY impact_score DESC, updated_at DESC
LIMIT @limit