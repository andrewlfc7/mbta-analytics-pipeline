{{
    config(
        materialized='table',
        cluster_by=[
            "stop_id",
            "municipality",
            "routes_served"
        ]
    )
}}

with stop_delays as (
    select
        stop_id,
        stop_name,
        municipality,
        latitude,
        longitude,
        route_id,
        route_name,
        route_type_desc,
        delay_seconds,
        is_late,
        is_significantly_late,
        extracted_at
    from {{ ref('int_scheduled_vs_actual') }}
    where delay_seconds is not null
),

stop_vehicles as (
    select
        stop_id,
        stop_name,
        municipality,
        route_id,
        activity_hour,
        vehicle_count,
        observation_count,
        mean_occupancy_pct,
        max_occupancy_pct
    from {{ ref('int_stop_activity') }}
),

delay_metrics as (
    select
        stop_id,
        stop_name,
        municipality,
        latitude,
        longitude,

        count(*) as total_predictions,
        count(distinct route_id) as routes_served,

        round(avg(delay_seconds), 1) as avg_delay_seconds,
        round({{ median_val('delay_seconds') }}, 1) as median_delay_seconds,
        round(100.0 * count(case when is_late then 1 end) / count(*), 2) as late_pct,
        round(
            100.0 * count(case when is_significantly_late then 1 end) / count(*), 2
        ) as significant_delay_pct,

        round({{ percentile_val('delay_seconds', 0.90) }}, 1) as p90_delay_seconds

    from stop_delays
    group by
        stop_id, stop_name, municipality, latitude, longitude
),

vehicle_metrics as (
    select
        stop_id,
        sum(vehicle_count) as total_vehicle_visits,
        round(avg(mean_occupancy_pct), 2) as avg_occupancy_pct,
        max(max_occupancy_pct) as peak_occupancy_pct
    from stop_vehicles
    group by stop_id
),

combined as (
    select
        d.*,
        v.total_vehicle_visits,
        v.avg_occupancy_pct,
        v.peak_occupancy_pct
    from delay_metrics d
    left join vehicle_metrics v
        on d.stop_id = v.stop_id
)

select
    *,
    round(
        (coalesce(late_pct, 0) * 0.4)
        + (coalesce(significant_delay_pct, 0) * 0.3)
        + (least(abs(coalesce(avg_delay_seconds, 0)) / 3.0, 100) * 0.3),
        1
    ) as delay_hotspot_score
from combined
order by delay_hotspot_score desc
