with source as (
    select * from {{ source('raw_mbta', 'raw_schedules') }}
),

cleaned as (
    select
        schedule_id,
        cast(arrival_time as timestamp) as scheduled_arrival,
        cast(departure_time as timestamp) as scheduled_departure,
        direction_id,
        stop_sequence,
        stop_headsign,
        pickup_type,
        drop_off_type,
        timepoint,
        route_id,
        stop_id,
        trip_id
    from source
    where schedule_id is not null
)

select * from cleaned
