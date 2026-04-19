with source as (
    select * from {{ source('raw_mbta', 'raw_trips') }}
),

cleaned as (
    select
        trip_id,
        headsign,
        nullif(name, '') as trip_name,
        direction_id,
        block_id,
        bikes_allowed,
        wheelchair_accessible,
        revenue,
        route_id,
        route_pattern_id,
        service_id,
        shape_id
    from source
    where trip_id is not null
      and route_id is not null
)

select * from cleaned