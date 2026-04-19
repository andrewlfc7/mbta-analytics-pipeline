with source as (
    select * from {{ source('raw_mbta', 'raw_vehicles') }}
),

cleaned as (
    select
        vehicle_id,
        label,
        latitude,
        longitude,
        bearing,
        speed,
        current_status,
        current_stop_sequence,
        direction_id,
        occupancy_status,
        carriage_count,
        avg_occupancy_pct,
        revenue,
        cast(updated_at as timestamp) as vehicle_updated_at,
        route_id,
        stop_id,
        trip_id,
        cast(extracted_at as timestamp) as extracted_at
    from source
    where vehicle_id is not null
)

select * from cleaned