with source as (
    select * from {{ source('raw_mbta', 'raw_weather') }}
),

cleaned as (
    select
        cast(timestamp as timestamp) as weather_timestamp,
        temperature_2m as temperature_f,
        relative_humidity_2m as humidity_pct,
        precipitation as precipitation_mm,
        rain as rain_mm,
        snowfall as snowfall_cm,
        wind_speed_10m as wind_speed_mph,
        wind_gusts_10m as wind_gusts_mph,
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
    where timestamp is not null
)

select * from cleaned