{{
    config(
        materialized='view'
    )
}}

with vehicles as (
    select
        vehicle_id,
        route_id,
        stop_id,
        trip_id,
        direction_id,
        current_status,
        avg_occupancy_pct,
        carriage_count,
        latitude,
        longitude,
        vehicle_updated_at,
        extracted_at,
        {{ dbt.date_trunc('hour', 'extracted_at') }} as activity_hour
    from {{ ref('stg_vehicles') }}
),

stops as (
    select
        stop_id,
        stop_name,
        municipality,
        location_type,
        location_type_desc
    from {{ ref('stg_stops') }}
),

routes as (
    select
        route_id,
        long_name as route_name,
        route_type,
        route_type_desc
    from {{ ref('stg_routes') }}
),

activity as (
    select
        v.stop_id,
        s.stop_name,
        s.municipality,
        s.location_type_desc,
        v.route_id,
        r.route_name,
        r.route_type_desc,
        v.activity_hour,
        v.direction_id,

        -- Counts
        count(distinct v.vehicle_id) as vehicle_count,
        count(*) as observation_count,

        -- Occupancy
        avg(v.avg_occupancy_pct) as mean_occupancy_pct,
        max(v.avg_occupancy_pct) as max_occupancy_pct,
        min(v.avg_occupancy_pct) as min_occupancy_pct,

        -- Status breakdown
        count(case when v.current_status = 'STOPPED_AT' then 1 end) as stopped_count,
        count(case when v.current_status = 'IN_TRANSIT_TO' then 1 end) as in_transit_count,
        count(case when v.current_status = 'INCOMING_AT' then 1 end) as incoming_count

    from vehicles v
    left join stops s on v.stop_id = s.stop_id
    left join routes r on v.route_id = r.route_id

    group by
        v.stop_id,
        s.stop_name,
        s.municipality,
        s.location_type_desc,
        v.route_id,
        r.route_name,
        r.route_type_desc,
        v.activity_hour,
        v.direction_id
)

select * from activity