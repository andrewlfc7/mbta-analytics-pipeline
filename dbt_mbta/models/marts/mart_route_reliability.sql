{{
    config(
        materialized='table'
    )
}}

with delays as (
    select
        route_id,
        route_name,
        route_type,
        route_type_desc,
        direction_id,
        prediction_id,
        delay_seconds,
        delay_category,
        is_late,
        is_significantly_late,
        extracted_at
    from {{ ref('int_scheduled_vs_actual') }}
    where delay_seconds is not null
),

route_metrics as (
    select
        route_id,
        route_name,
        route_type,
        route_type_desc,

        -- Volume
        count(*) as total_predictions,

        -- On-time performance (within 60 seconds)
        count(case when not is_late then 1 end) as on_time_count,
        round(100.0 * count(case when not is_late then 1 end) / count(*), 2) as on_time_pct,

        -- Delay stats
        round(avg(delay_seconds), 1) as avg_delay_seconds,
        round(median(delay_seconds), 1) as median_delay_seconds,
        round(stddev(delay_seconds), 1) as stddev_delay_seconds,
        min(delay_seconds) as min_delay_seconds,
        max(delay_seconds) as max_delay_seconds,

        -- Percentiles
        round(percentile_cont(0.75) within group (order by delay_seconds), 1) as p75_delay_seconds,
        round(percentile_cont(0.90) within group (order by delay_seconds), 1) as p90_delay_seconds,
        round(percentile_cont(0.95) within group (order by delay_seconds), 1) as p95_delay_seconds,

        -- Delay category distribution
        count(case when delay_category = 'early' then 1 end) as early_count,
        count(case when delay_category = 'on_time' then 1 end) as on_time_strict_count,
        count(case when delay_category = 'slightly_late' then 1 end) as slightly_late_count,
        count(case when delay_category = 'late' then 1 end) as late_count,
        count(case when delay_category = 'very_late' then 1 end) as very_late_count,

        -- Significantly late rate
        round(100.0 * count(case when is_significantly_late then 1 end) / count(*), 2) as significant_delay_pct

    from delays
    group by
        route_id,
        route_name,
        route_type,
        route_type_desc
)

select
    *,
    -- Reliability score (0-100, higher = better)
    round(
        (on_time_pct * 0.5)
        + ((100.0 - least(significant_delay_pct * 5, 100)) * 0.3)
        + ((100.0 - least(abs(avg_delay_seconds) / 6.0, 100)) * 0.2),
        1
    ) as reliability_score
from route_metrics
order by reliability_score desc