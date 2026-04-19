{{
    config(
        materialized='table'
    )
}}

with alerts as (
    select
        alert_id,
        cause,
        effect,
        severity,
        severity_category,
        lifecycle,
        header,
        service_effect,
        duration_certainty,
        active_start,
        active_end,
        duration_seconds,
        duration_hours,
        is_active,
        affected_routes,
        affected_stops,
        informed_entity_count,
        created_at,
        updated_at
    from {{ ref('int_alert_impacts') }}
),

enriched as (
    select
        alert_id,
        cause,
        effect,
        severity,
        severity_category,
        lifecycle,
        header,
        service_effect,
        is_active,

        active_start,
        active_end,
        duration_hours,

        -- Affected entity counts
        affected_routes,
        affected_stops,
        informed_entity_count,
        len(affected_routes) as affected_route_count,
        len(affected_stops) as affected_stop_count,

        -- Impact score: severity × entities affected
        round(
            severity
            * (1 + ln(1 + informed_entity_count))
            * case
                when effect in ('SUSPENSION', 'DETOUR', 'STOP_CLOSURE') then 2.0
                when effect in ('DELAY', 'SERVICE_CHANGE') then 1.5
                when effect in ('STATION_ISSUE', 'STOP_MOVED') then 1.2
                else 1.0
              end,
            2
        ) as impact_score,

        created_at,
        updated_at

    from alerts
)

select * from enriched
order by impact_score desc