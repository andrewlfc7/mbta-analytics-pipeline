{{
    config(
        materialized='view'
    )
}}

with alerts as (
    select
        alert_id,
        cause,
        effect,
        severity,
        lifecycle,
        header,
        service_effect,
        duration_certainty,
        active_start,
        active_end,
        created_at,
        updated_at,
        closed_timestamp,
        affected_routes,
        affected_stops,
        informed_entity_count,
        extracted_at,

        -- Duration metrics
        case
            when active_end is not null and active_start is not null then
                {{ datediff('active_start', 'active_end', 'second') }}
            else null
        end as duration_seconds,

        case
            when active_end is not null and active_start is not null then
                {{ datediff('active_start', 'active_end', 'second') }} / 3600.0
            else null
        end as duration_hours,

        -- Severity classification
        case
            when severity >= 7 then 'critical'
            when severity >= 4 then 'major'
            when severity >= 2 then 'minor'
            else 'informational'
        end as severity_category,

        -- Is currently active
        case
            when lifecycle = 'ONGOING' then true
            when active_end is null and closed_timestamp is null then true
            else false
        end as is_active

    from {{ ref('stg_alerts') }}
)

select * from alerts