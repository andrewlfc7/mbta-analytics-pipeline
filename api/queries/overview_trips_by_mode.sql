SELECT
  route_type_desc AS mode,
  SUM(total_predictions) AS trips
FROM `{project}.marts.mart_route_reliability`
GROUP BY route_type_desc
ORDER BY trips DESC