{% set timestamp_col = '`timestamp`' if target.type == 'bigquery' else '"timestamp"' %}

with source as (
    select * from {{ source('raw_mbta', 'raw_weather') }}
),

cleaned as (
    select
        {{ parse_ts(timestamp_col) }} as weather_timestamp,

        -- Open-Meteo defaults to Celsius unless temperature_unit is set.
        temperature_2m as temperature_c,
        round((temperature_2m * 9.0 / 5.0) + 32.0, 1) as temperature_f,

        relative_humidity_2m as humidity_pct,

        precipitation as precipitation_mm,
        round(precipitation / 25.4, 3) as precipitation_in,

        rain as rain_mm,
        round(rain / 25.4, 3) as rain_in,

        snowfall as snowfall_cm,
        round(snowfall / 2.54, 3) as snowfall_in,

        wind_speed_10m as wind_speed_kmh,
        round(wind_speed_10m * 0.621371, 1) as wind_speed_mph,

        wind_gusts_10m as wind_gusts_kmh,
        round(wind_gusts_10m * 0.621371, 1) as wind_gusts_mph,

        visibility as visibility_m,
        weather_code,

        case
            when weather_code in (0) then 'Clear'
            when weather_code in (1, 2, 3) then 'Cloudy'
            when weather_code in (45, 48) then 'Fog'
            when weather_code in (51, 53, 55, 56, 57) then 'Drizzle'
            when weather_code in (61, 63, 65, 66, 67) then 'Rain'
            when weather_code in (71, 73, 75, 77) then 'Snow'
            when weather_code in (80, 81, 82) then 'Rain Showers'
            when weather_code in (85, 86) then 'Snow Showers'
            when weather_code in (95, 96, 99) then 'Thunderstorm'
            else 'Unknown'
        end as weather_condition
    from source
    where {{ timestamp_col }} is not null
)

select * from cleaned
