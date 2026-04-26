{{
    config(
        materialized='table',
        partition_by={
            "field": "prediction_hour",
            "data_type": "timestamp",
            "granularity": "day"
        },
        cluster_by=[
            "route_id",
            "stop_id",
            "weather_condition",
            "weather_code"
        ]
    )
}}

with delays as (
    select
        prediction_id,
        route_id,
        stop_id,
        trip_id,
        predicted_arrival,
        predicted_departure,
        scheduled_arrival,
        scheduled_departure,
        delay_seconds,
        extracted_at,
        {{ dbt.date_trunc('hour', 'coalesce(predicted_arrival, predicted_departure)') }} as prediction_hour
    from {{ ref('int_scheduled_vs_actual') }}
),

weather as (
    select
        weather_timestamp,
        temperature_f,
        humidity_pct,
        precipitation_mm,
        rain_mm,
        snowfall_cm,
        wind_speed_mph,
        wind_gusts_mph,
        visibility_m,
        weather_code,
        weather_condition
    from {{ ref('stg_weather') }}
),

joined as (
    select
        d.prediction_id,
        d.route_id,
        d.stop_id,
        d.trip_id,
        d.predicted_arrival,
        d.predicted_departure,
        d.prediction_hour,
        d.scheduled_arrival,
        d.scheduled_departure,
        d.delay_seconds,

        -- Weather at prediction hour
        w.temperature_f,
        w.humidity_pct,
        w.precipitation_mm,
        w.rain_mm,
        w.snowfall_cm,
        w.wind_speed_mph,
        w.wind_gusts_mph,
        w.visibility_m,
        w.weather_code,
        w.weather_condition,

        case when w.precipitation_mm > 0 then true else false end as is_precipitation,
        case when w.snowfall_cm > 0 then true else false end as is_snow,
        case when w.visibility_m < 5000 then true else false end as is_low_visibility,
        case when w.wind_speed_mph > 25 then true else false end as is_high_wind,

        d.extracted_at

    from delays d

    left join weather w
        on d.prediction_hour = w.weather_timestamp
)

select * from joined
