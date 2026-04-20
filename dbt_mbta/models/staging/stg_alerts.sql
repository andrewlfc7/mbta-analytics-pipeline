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
        {% if target.type == 'bigquery' %}
        ARRAY(
            SELECT e.element
            FROM UNNEST(affected_routes.list) AS e
        ) as affected_routes,
        ARRAY(
            SELECT e.element
            FROM UNNEST(affected_stops.list) AS e
        ) as affected_stops,
        {% else %}
        affected_routes,
        affected_stops,
        {% endif %}
        informed_entity_count,
        cast(extracted_at as timestamp) as extracted_at
    from source
    where alert_id is not null
),

deduped as (
    select
        *,
        row_number() over (
            partition by alert_id
            order by coalesce(updated_at, extracted_at) desc, extracted_at desc
        ) as _dedupe_rank
    from cleaned
)

select
    alert_id,
    cause,
    effect,
    severity,
    lifecycle,
    header,
    description,
    short_header,
    service_effect,
    duration_certainty,
    active_start,
    active_end,
    created_at,
    updated_at,
    closed_timestamp,
    url,
    affected_routes,
    affected_stops,
    informed_entity_count,
    extracted_at
from deduped
where _dedupe_rank = 1
