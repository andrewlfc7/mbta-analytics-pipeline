{{
    config(
        materialized='table'
    )
}}

with predictions as (
    select
        prediction_id,
        route_id,
        stop_id,
        trip_id,
        predicted_arrival,
        predicted_departure,
        extracted_at,
        -- Get the hour for weather join
        {{ dbt.date_trunc('hour', 'coalesce(predicted_arrival, predicted_departure)') }} as prediction_hour
    from {{ ref('stg_predictions') }}
    where coalesce(predicted_arrival, predicted_departure) is not null
),

schedules as (
    select
        trip_id,
        stop_id,
        scheduled_arrival,
        scheduled_departure
    from {{ ref('stg_schedules') }}
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

with_delay as (
    select
        p.prediction_id,
        p.route_id,
        p.stop_id,
        p.trip_id,
        p.predicted_arrival,
        p.predicted_departure,
        p.prediction_hour,

        -- Scheduled times
        sch.scheduled_arrival,
        sch.scheduled_departure,

        case
            when p.predicted_arrival is not null and sch.scheduled_arrival is not null then
                {{ timestamp_diff_seconds('sch.scheduled_arrival', 'p.predicted_arrival') }}
        end as arrival_delay_seconds,

        case
            when p.predicted_departure is not null and sch.scheduled_departure is not null then
                {{ timestamp_diff_seconds('sch.scheduled_departure', 'p.predicted_departure') }}
        end as departure_delay_seconds,

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

        -- Weather flags for modeling
        case when w.precipitation_mm > 0 then true else false end as is_precipitation,
        case when w.snowfall_cm > 0 then true else false end as is_snow,
        case when w.visibility_m < 5000 then true else false end as is_low_visibility,
        case when w.wind_speed_mph > 25 then true else false end as is_high_wind,

        p.extracted_at

    from predictions p

    left join schedules sch
        on p.trip_id = sch.trip_id
        and p.stop_id = sch.stop_id

    left join weather w
        on p.prediction_hour = w.weather_timestamp
),

normalized as (
    select
        prediction_id,
        route_id,
        stop_id,
        trip_id,
        predicted_arrival,
        predicted_departure,
        prediction_hour,
        scheduled_arrival,
        scheduled_departure,
        coalesce(arrival_delay_seconds, departure_delay_seconds) as delay_seconds,
        temperature_f,
        humidity_pct,
        precipitation_mm,
        rain_mm,
        snowfall_cm,
        wind_speed_mph,
        wind_gusts_mph,
        visibility_m,
        weather_code,
        weather_condition,
        is_precipitation,
        is_snow,
        is_low_visibility,
        is_high_wind,
        extracted_at
    from with_delay
)

select * from normalized
