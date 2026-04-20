with source as (
    select * from {{ source('raw_mbta', 'raw_predictions') }}
),

cleaned as (
    select
        prediction_id,
        cast(arrival_time as timestamp) as predicted_arrival,
        arrival_uncertainty,
        cast(departure_time as timestamp) as predicted_departure,
        departure_uncertainty,
        direction_id,
        stop_sequence,
        schedule_relationship,
        status,
        revenue,
        last_trip,
        update_type,
        route_id,
        stop_id,
        trip_id,
        vehicle_id,
        cast(extracted_at as timestamp) as extracted_at
    from source
    where prediction_id is not null
),

deduped as (
    select
        *,
        row_number() over (
            partition by prediction_id, extracted_at
            order by extracted_at desc
        ) as _dedupe_rank
    from cleaned
)

select
    prediction_id,
    predicted_arrival,
    arrival_uncertainty,
    predicted_departure,
    departure_uncertainty,
    direction_id,
    stop_sequence,
    schedule_relationship,
    status,
    revenue,
    last_trip,
    update_type,
    route_id,
    stop_id,
    trip_id,
    vehicle_id,
    extracted_at
from deduped
where _dedupe_rank = 1
