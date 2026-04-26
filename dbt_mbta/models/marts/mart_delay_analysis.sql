{{
    config(
        materialized='table',
        cluster_by=[
            "route_id",
            "route_type_desc",
            "day_type",
            "hour_of_day",
            "direction_id"
        ]
    )
}}

with base as (
    select
        prediction_id,
        route_id,
        route_name,
        route_type,
        route_type_desc,
        stop_id,
        stop_name,
        direction_id,
        service_date,
        delay_seconds,
        delay_category,
        is_late,
        is_significantly_late,
        extracted_at,

        -- Time dimensions from predicted/scheduled time
        extract(hour from coalesce(predicted_arrival, predicted_departure)) as hour_of_day,
        {{ get_day_of_week('service_date') }} as day_of_week,
        case
            when {{ is_weekend('service_date') }} then 'weekend'
            else 'weekday'
        end as day_type,
        case
            when extract(hour from coalesce(predicted_arrival, predicted_departure)) between 6 and 9 then 'morning_rush'
            when extract(hour from coalesce(predicted_arrival, predicted_departure)) between 10 and 15 then 'midday'
            when extract(hour from coalesce(predicted_arrival, predicted_departure)) between 16 and 19 then 'evening_rush'
            when extract(hour from coalesce(predicted_arrival, predicted_departure)) between 20 and 23 then 'evening'
            else 'overnight'
        end as time_period

    from {{ ref('int_scheduled_vs_actual') }}
    where delay_seconds is not null
),

aggregated as (
    select
        route_id,
        route_name,
        route_type_desc,
        direction_id,
        hour_of_day,
        day_of_week,
        day_type,
        time_period,

        count(*) as prediction_count,

        round(avg(delay_seconds), 1) as avg_delay_seconds,
        round({{ median_val('delay_seconds') }}, 1) as median_delay_seconds,
        round(stddev(delay_seconds), 1) as stddev_delay_seconds,

        round(100.0 * count(case when not is_late then 1 end) / count(*), 2) as on_time_pct,
        round(100.0 * count(case when is_late then 1 end) / count(*), 2) as late_pct,
        round(
            100.0 * count(case when is_significantly_late then 1 end) / count(*), 2
        ) as significant_delay_pct,

        -- Category counts
        count(case when delay_category = 'early' then 1 end) as early_count,
        count(case when delay_category = 'on_time' then 1 end) as on_time_count,
        count(case when delay_category = 'slightly_late' then 1 end) as slightly_late_count,
        count(case when delay_category = 'late' then 1 end) as late_count,
        count(case when delay_category = 'very_late' then 1 end) as very_late_count

    from base
    group by
        route_id,
        route_name,
        route_type_desc,
        direction_id,
        hour_of_day,
        day_of_week,
        day_type,
        time_period
)

select * from aggregated
