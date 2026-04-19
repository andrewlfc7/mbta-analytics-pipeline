with source as (
    select * from {{ source('raw_mbta', 'raw_stops') }}
),

cleaned as (
    select
        stop_id,
        name as stop_name,
        description,
        latitude,
        longitude,
        address,
        municipality,
        on_street,
        at_street,
        location_type,
        location_type_desc,
        vehicle_type,
        vehicle_type_desc,
        platform_code,
        platform_name,
        wheelchair_boarding,
        parent_station_id,
        zone_id
    from source
    where stop_id is not null
      and latitude is not null
      and longitude is not null
)

select * from cleaned