{{
    config(
        materialized='view'
    )
}}

with predictions as (
    select
        prediction_id,
        predicted_arrival,
        predicted_departure,
        arrival_uncertainty,
        departure_uncertainty,
        direction_id,
        stop_sequence,
        schedule_relationship,
        status,
        revenue,
        update_type,
        route_id,
        stop_id,
        trip_id,
        vehicle_id,
        extracted_at
    from {{ ref('stg_predictions') }}
),

schedules as (
    select
        trip_id,
        stop_id,
        scheduled_arrival,
        scheduled_departure,
        stop_sequence,
        timepoint
    from {{ ref('stg_schedules') }}
),

routes as (
    select
        route_id,
        long_name as route_name,
        route_type,
        route_type_desc
    from {{ ref('stg_routes') }}
),

stops as (
    select
        stop_id,
        stop_name,
        municipality,
        latitude,
        longitude
    from {{ ref('stg_stops') }}
),

joined as (
    select
        p.prediction_id,
        p.route_id,
        r.route_name,
        r.route_type,
        r.route_type_desc,
        p.stop_id,
        s.stop_name,
        s.municipality,
        s.latitude,
        s.longitude,
        p.trip_id,
        p.vehicle_id,
        p.direction_id,
        p.stop_sequence,

        -- Scheduled times
        sch.scheduled_arrival,
        sch.scheduled_departure,
        sch.timepoint,

        -- Predicted times
        p.predicted_arrival,
        p.predicted_departure,
        p.arrival_uncertainty,
        p.departure_uncertainty,

        -- Delay computation (use arrival if available, else departure)
        case
            when p.predicted_arrival is not null and sch.scheduled_arrival is not null then
                epoch(p.predicted_arrival) - epoch(sch.scheduled_arrival)
            when p.predicted_departure is not null and sch.scheduled_departure is not null then
                epoch(p.predicted_departure) - epoch(sch.scheduled_departure)
            else null
        end as delay_seconds,

        -- Delay classification
        case
            when delay_seconds is null then 'unknown'
            when delay_seconds <= -60 then 'early'
            when delay_seconds <= 60 then 'on_time'
            when delay_seconds <= 300 then 'slightly_late'
            when delay_seconds <= 600 then 'late'
            else 'very_late'
        end as delay_category,

        -- Boolean flags
        case when delay_seconds > 60 then true else false end as is_late,
        case when delay_seconds > 300 then true else false end as is_significantly_late,

        p.schedule_relationship,
        p.status,
        p.revenue,
        p.update_type,
        p.extracted_at

    from predictions p

    left join schedules sch
        on p.trip_id = sch.trip_id
        and p.stop_id = sch.stop_id

    left join routes r
        on p.route_id = r.route_id

    left join stops s
        on p.stop_id = s.stop_id
)

select * from joined