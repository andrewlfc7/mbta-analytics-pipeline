with source as (
    select * from {{ source('raw_mbta', 'raw_alerts') }}
),

cleaned as (
    select
        alert_id,
        cause,
        effect,
        severity,
        lifecycle,
        header,
        description,
        nullif(short_header, '') as short_header,
        service_effect,
        duration_certainty,
        cast(active_start as timestamp) as active_start,
        cast(active_end as timestamp) as active_end,
        cast(created_at as timestamp) as created_at,
        cast(updated_at as timestamp) as updated_at,
        cast(closed_timestamp as timestamp) as closed_timestamp,
        url,
        affected_routes,
        affected_stops,
        informed_entity_count,
        cast(extracted_at as timestamp) as extracted_at
    from source
    where alert_id is not null
)

select * from cleaned