WITH origin_stops AS (
  SELECT stop_id
  FROM `{project}.raw_mbta.raw_stops`
  WHERE stop_id = '@origin_stop'
     OR parent_station_id = '@origin_stop'
),

dest_stops AS (
  SELECT stop_id
  FROM `{project}.raw_mbta.raw_stops`
  WHERE stop_id = '@dest_stop'
     OR parent_station_id = '@dest_stop'
),

direct_routes AS (
  SELECT
    'direct' AS connection_type,
    0 AS transfers,

    o.route_id AS first_route_id,
    r.long_name AS first_route_name,
    r.route_type AS first_route_type,
    r.route_type_desc AS first_route_type_desc,
    COALESCE(r.color, '7F7F7F') AS first_route_color,

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
  FROM `{project}.raw_mbta.raw_schedules` o
  JOIN `{project}.raw_mbta.raw_schedules` d
    ON o.trip_id = d.trip_id
   AND o.route_id = d.route_id
   AND o.direction_id = d.direction_id
   AND o.stop_sequence < d.stop_sequence
  JOIN origin_stops os
    ON o.stop_id = os.stop_id
  JOIN dest_stops ds
    ON d.stop_id = ds.stop_id
  JOIN `{project}.raw_mbta.raw_routes` r
    ON o.route_id = r.route_id
  WHERE o.departure_time IS NOT NULL
    AND d.arrival_time IS NOT NULL
  GROUP BY
    o.route_id, r.long_name, r.route_type, r.route_type_desc, r.color
),

transfer_routes AS (
  SELECT
    'transfer' AS connection_type,
    1 AS transfers,

    leg1.route_id AS first_route_id,
    r1.long_name AS first_route_name,
    r1.route_type AS first_route_type,
    r1.route_type_desc AS first_route_type_desc,
    COALESCE(r1.color, '7F7F7F') AS first_route_color,

    leg2.route_id AS second_route_id,
    r2.long_name AS second_route_name,
    r2.route_type AS second_route_type,
    r2.route_type_desc AS second_route_type_desc,
    COALESCE(r2.color, '7F7F7F') AS second_route_color,

    leg1_dest.stop_id AS transfer_stop_id,
    xfer_stop.name AS transfer_stop_name,

    MIN(leg1.departure_time) AS first_departure,
    MIN(leg2_dest.arrival_time) AS final_arrival,
    COUNT(DISTINCT leg1.trip_id) AS matching_trips
  FROM `{project}.raw_mbta.raw_schedules` leg1
  JOIN origin_stops os
    ON leg1.stop_id = os.stop_id

  JOIN `{project}.raw_mbta.raw_schedules` leg1_dest
    ON leg1.trip_id = leg1_dest.trip_id
   AND leg1.route_id = leg1_dest.route_id
   AND leg1.direction_id = leg1_dest.direction_id
   AND leg1.stop_sequence < leg1_dest.stop_sequence

  JOIN `{project}.raw_mbta.raw_schedules` leg2
    ON leg1_dest.stop_id = leg2.stop_id
   AND leg1.route_id != leg2.route_id

  JOIN `{project}.raw_mbta.raw_schedules` leg2_dest
    ON leg2.trip_id = leg2_dest.trip_id
   AND leg2.route_id = leg2_dest.route_id
   AND leg2.direction_id = leg2_dest.direction_id
   AND leg2.stop_sequence < leg2_dest.stop_sequence

  JOIN dest_stops ds
    ON leg2_dest.stop_id = ds.stop_id

  JOIN `{project}.raw_mbta.raw_routes` r1
    ON leg1.route_id = r1.route_id
  JOIN `{project}.raw_mbta.raw_routes` r2
    ON leg2.route_id = r2.route_id
  JOIN `{project}.raw_mbta.raw_stops` xfer_stop
    ON leg1_dest.stop_id = xfer_stop.stop_id

  WHERE leg1.departure_time IS NOT NULL
    AND leg2.departure_time IS NOT NULL
    AND leg2_dest.arrival_time IS NOT NULL
    AND leg1_dest.arrival_time <= leg2.departure_time

  GROUP BY
    leg1.route_id, r1.long_name, r1.route_type, r1.route_type_desc, r1.color,
    leg2.route_id, r2.long_name, r2.route_type, r2.route_type_desc, r2.color,
    leg1_dest.stop_id, xfer_stop.name
)

SELECT *
FROM direct_routes

UNION ALL

SELECT *
FROM transfer_routes

ORDER BY
  transfers,
  matching_trips DESC,
  first_route_type,
  first_route_id
LIMIT 25