SELECT
  route_id,
  ROUND(on_time_pct, 1) AS on_time_pct,
  ROUND(avg_delay_seconds / 60.0, 1) AS avg_delay_minutes,
  ROUND(SAFE_DIVIDE(COUNTIF(delay_seconds > 300), COUNT(*)) * 100, 1) AS delay_risk_pct
FROM (
  SELECT
    route_id,
    delay_seconds,
    AVG(delay_seconds) OVER (PARTITION BY route_id) AS avg_delay_seconds,
    SAFE_DIVIDE(
      COUNTIF(delay_seconds <= 120) OVER (PARTITION BY route_id),
      COUNT(*) OVER (PARTITION BY route_id)
    ) * 100 AS on_time_pct
  FROM `{project}.intermediate.int_scheduled_vs_actual`
  WHERE route_id IN UNNEST(@route_ids)
)
GROUP BY route_id, on_time_pct, avg_delay_seconds
