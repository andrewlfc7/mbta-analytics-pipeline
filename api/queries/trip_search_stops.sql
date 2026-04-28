WITH query AS (
  SELECT
    LOWER(REGEXP_REPLACE(TRIM('@query'), r'[^a-z0-9 ]', ' ')) AS q
),

tokens AS (
  SELECT DISTINCT token
  FROM query, UNNEST(SPLIT(q, ' ')) AS token
  WHERE LENGTH(token) >= 3
),

stop_base AS (
  SELECT
    s.stop_id,
    s.name AS stop_name,
    s.municipality,
    s.latitude,
    s.longitude,
    s.location_type,
    CASE
      WHEN s.location_type = 1 THEN 'Station'
      WHEN s.location_type = 0 THEN 'Stop'
      ELSE 'Node'
    END AS location_type_desc,
    LOWER(CONCAT(
      COALESCE(s.name, ''), ' ',
      COALESCE(s.municipality, ''), ' ',
      COALESCE(s.stop_id, '')
    )) AS stop_text
  FROM `{project}.raw_mbta.raw_stops` s
  WHERE s.name IS NOT NULL
    AND s.latitude IS NOT NULL
    AND s.longitude IS NOT NULL
    AND NOT STARTS_WITH(s.stop_id, 'node-')
    AND NOT STARTS_WITH(s.stop_id, 'door-')
),

route_stop_context AS (
  SELECT
    sch.stop_id,
    STRING_AGG(
      DISTINCT LOWER(CONCAT(
        COALESCE(r.route_id, ''), ' ',
        COALESCE(r.short_name, ''), ' ',
        COALESCE(r.long_name, ''), ' ',
        COALESCE(r.description, '')
      )),
      ' '
    ) AS route_text,
    COUNT(DISTINCT sch.route_id) AS routes_served
  FROM `{project}.raw_mbta.raw_schedules` sch
  JOIN `{project}.raw_mbta.raw_routes` r
    ON sch.route_id = r.route_id
  GROUP BY sch.stop_id
),

scored AS (
  SELECT
    sb.stop_id,
    sb.stop_name,
    sb.municipality,
    sb.latitude,
    sb.longitude,
    sb.location_type,
    sb.location_type_desc,
    COALESCE(rsc.routes_served, 0) AS routes_served,

    (
      -- exact/full phrase stop match
      CASE
        WHEN sb.stop_text = (SELECT q FROM query) THEN 120
        WHEN sb.stop_text LIKE CONCAT('%', (SELECT q FROM query), '%') THEN 90
        ELSE 0
      END

      -- token matches in stop name / municipality
      + 12 * (
        SELECT COUNT(*)
        FROM tokens
        WHERE sb.stop_text LIKE CONCAT('%', token, '%')
      )

      -- token matches in route names serving that stop
      + 8 * (
        SELECT COUNT(*)
        FROM tokens
        WHERE COALESCE(rsc.route_text, '') LIKE CONCAT('%', token, '%')
      )

      -- phrase match in route long name/context
      + CASE
          WHEN COALESCE(rsc.route_text, '') LIKE CONCAT('%', (SELECT q FROM query), '%')
          THEN 70
          ELSE 0
        END

      -- prefer public stop/station records over internal nodes
      + CASE
          WHEN sb.location_type = 1 THEN 10
          WHEN sb.location_type = 0 THEN 8
          ELSE 0
        END
    ) AS match_score,

    CASE
      WHEN sb.stop_text LIKE CONCAT('%', (SELECT q FROM query), '%') THEN 'stop_name'
      WHEN COALESCE(rsc.route_text, '') LIKE CONCAT('%', (SELECT q FROM query), '%') THEN 'route_name'
      ELSE 'token_match'
    END AS match_source

  FROM stop_base sb
  LEFT JOIN route_stop_context rsc
    ON sb.stop_id = rsc.stop_id
),

filtered AS (
  SELECT *
  FROM scored
  WHERE match_score > 0
)

SELECT
  stop_id,
  stop_name,
  municipality,
  latitude,
  longitude,
  location_type,
  location_type_desc,
  routes_served,
  match_score,
  match_source
FROM filtered
ORDER BY
  match_score DESC,
  routes_served DESC,
  CASE
    WHEN location_type = 1 THEN 0
    WHEN location_type = 0 THEN 1
    ELSE 2
  END,
  stop_name
LIMIT 15