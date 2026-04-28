WITH stop_lookup AS (
  SELECT
    stop_id,
    parent_station_id,
    COALESCE(parent_station_id, stop_id) AS stop_group,
    name AS stop_name
  FROM `{project}.raw_mbta.raw_stops`
),

origin_stops AS (
  SELECT
    stop_id,
    stop_group,
    stop_name
  FROM stop_lookup
  WHERE stop_id = '@origin_stop'
     OR parent_station_id = '@origin_stop'
),

dest_stops AS (
  SELECT
    stop_id,
    stop_group,
    stop_name
  FROM stop_lookup
  WHERE stop_id = '@dest_stop'
     OR parent_station_id = '@dest_stop'
),

schedule_enriched AS (
  SELECT
    sch.trip_id,
    sch.route_id,
    sch.stop_id,
    sch.direction_id,
    sch.stop_sequence,
    sch.arrival_time,
    sch.departure_time,
    sl.stop_group,
    sl.stop_name,
    r.long_name AS route_name,
    r.route_type,
    r.route_type_desc,
    COALESCE(r.color, '7F7F7F') AS route_color
  FROM `{project}.raw_mbta.raw_schedules` sch
  JOIN stop_lookup sl
    ON sch.stop_id = sl.stop_id
  JOIN `{project}.raw_mbta.raw_routes` r
    ON sch.route_id = r.route_id
  WHERE sch.departure_time IS NOT NULL
),

direct_routes AS (
  SELECT
    'direct' AS connection_type,
    0 AS transfers,

    o.route_id AS first_route_id,
    ANY_VALUE(o.route_name) AS first_route_name,
    ANY_VALUE(o.route_type) AS first_route_type,
    ANY_VALUE(o.route_type_desc) AS first_route_type_desc,
    ANY_VALUE(o.route_color) AS first_route_color,

    CAST(NULL AS STRING) AS second_route_id,
    CAST(NULL AS STRING) AS second_route_name,
    CAST(NULL AS INT64) AS second_route_type,
    CAST(NULL AS STRING) AS second_route_type_desc,
    CAST(NULL AS STRING) AS second_route_color,

    CAST(NULL AS STRING) AS transfer_stop_id,
    CAST(NULL AS STRING) AS transfer_stop_name,

    MIN(o.departure_time) AS first_departure,
    MIN(d.arrival_time) AS final_arrival,
    COUNT(DISTINCT o.trip_id) AS matching_trips

  FROM schedule_enriched o
  JOIN origin_stops os
    ON o.stop_id = os.stop_id

  JOIN schedule_enriched d
    ON o.trip_id = d.trip_id
   AND o.route_id = d.route_id
   AND o.direction_id = d.direction_id
   AND o.stop_sequence < d.stop_sequence

  JOIN dest_stops ds
    ON d.stop_id = ds.stop_id

  WHERE d.arrival_time IS NOT NULL

  GROUP BY
    o.route_id
),

transfer_routes AS (
  SELECT
    'transfer' AS connection_type,
    1 AS transfers,

    leg1.route_id AS first_route_id,
    ANY_VALUE(leg1.route_name) AS first_route_name,
    ANY_VALUE(leg1.route_type) AS first_route_type,
    ANY_VALUE(leg1.route_type_desc) AS first_route_type_desc,
    ANY_VALUE(leg1.route_color) AS first_route_color,

    leg2.route_id AS second_route_id,
    ANY_VALUE(leg2.route_name) AS second_route_name,
    ANY_VALUE(leg2.route_type) AS second_route_type,
    ANY_VALUE(leg2.route_type_desc) AS second_route_type_desc,
    ANY_VALUE(leg2.route_color) AS second_route_color,

    leg1_dest.stop_group AS transfer_stop_id,
    ANY_VALUE(leg1_dest.stop_name) AS transfer_stop_name,

    MIN(leg1.departure_time) AS first_departure,
    MIN(leg2_dest.arrival_time) AS final_arrival,

    COUNT(DISTINCT CONCAT(leg1.trip_id, '->', leg2.trip_id)) AS matching_trips

  FROM schedule_enriched leg1

  JOIN origin_stops os
    ON leg1.stop_id = os.stop_id

  JOIN schedule_enriched leg1_dest
    ON leg1.trip_id = leg1_dest.trip_id
   AND leg1.route_id = leg1_dest.route_id
   AND leg1.direction_id = leg1_dest.direction_id
   AND leg1.stop_sequence < leg1_dest.stop_sequence

  -- Transfer by station/place group, not exact stop_id.
  -- Example: 875 Forest Hills bus stop -> 70001 Forest Hills Orange Line.
  JOIN schedule_enriched leg2
    ON leg1_dest.stop_group = leg2.stop_group
   AND leg1.route_id != leg2.route_id

  JOIN schedule_enriched leg2_dest
    ON leg2.trip_id = leg2_dest.trip_id
   AND leg2.route_id = leg2_dest.route_id
   AND leg2.direction_id = leg2_dest.direction_id
   AND leg2.stop_sequence < leg2_dest.stop_sequence

  JOIN dest_stops ds
    ON leg2_dest.stop_id = ds.stop_id

  WHERE leg1_dest.arrival_time IS NOT NULL
    AND leg2.departure_time IS NOT NULL
    AND leg2_dest.arrival_time IS NOT NULL

  GROUP BY
    leg1.route_id,
    leg2.route_id,
    leg1_dest.stop_group
),

ranked AS (
  SELECT *
  FROM direct_routes

  UNION ALL

  SELECT *
  FROM transfer_routes
)

SELECT *
FROM ranked
ORDER BY
  transfers,
  matching_trips DESC,
  CASE
    WHEN first_route_id = '32' AND second_route_id = 'Orange' THEN 0
    ELSE 1
  END,
  first_route_type,
  first_route_id,
  second_route_id
LIMIT 25
