WITH route_stats AS (
  SELECT
    route_type_desc,
    SUM(total_predictions) AS trips,
    SUM(on_time_count) AS on_time_trips,
    SUM(total_predictions * avg_delay_seconds) AS weighted_delay
  FROM `{project}.marts.mart_route_reliability`
  GROUP BY route_type_desc
),
totals AS (
  SELECT
    COALESCE(SUM(trips), 0) AS total_trips,
    ROUND(
      SAFE_DIVIDE(SUM(on_time_trips) * 100.0, SUM(trips)), 1
    ) AS on_time_pct,
    ROUND(
      SAFE_DIVIDE(SUM(weighted_delay), SUM(trips)) / 60.0, 1
    ) AS avg_delay_minutes
  FROM route_stats
),
alert_stats AS (
  SELECT
    COUNTIF(is_active) AS active_alerts,
    COUNTIF(is_active AND severity >= 7) AS critical_alerts,
    COUNTIF(is_active AND severity >= 4 AND severity < 7) AS major_alerts,
    COUNTIF(is_active AND severity >= 1 AND severity < 4) AS minor_alerts,
    COUNTIF(is_active AND (severity < 1 OR severity IS NULL)) AS info_alerts
  FROM `{project}.marts.mart_alert_summary`
),
freshness AS (
  SELECT MAX(extracted_at) AS last_updated
  FROM `{project}.raw_mbta.raw_predictions`
)
SELECT
  t.total_trips,
  t.on_time_pct,
  t.avg_delay_minutes,
  a.active_alerts,
  a.critical_alerts,
  a.major_alerts,
  a.minor_alerts,
  a.info_alerts,
  f.last_updated
FROM totals t
CROSS JOIN alert_stats a
CROSS JOIN freshness f