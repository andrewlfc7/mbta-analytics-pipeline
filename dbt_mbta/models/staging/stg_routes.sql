with source as (
    select * from {{ source('raw_mbta', 'raw_routes') }}
),

cleaned as (
    select
        route_id,
        long_name,
        nullif(short_name, '') as short_name,
        description,
        fare_class,
        route_type,
        route_type_desc,
        color,
        text_color,
        sort_order,
        listed_route,
        line_id,
        agency_id
    from source
    where route_id is not null
)

select * from cleaned