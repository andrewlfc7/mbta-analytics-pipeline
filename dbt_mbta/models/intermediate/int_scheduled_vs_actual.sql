{{
    config(
        materialized='table',
        partition_by={
            "field": "service_date",
            "data_type": "date"
        },
        cluster_by=[
            "route_id",
            "stop_id",
            "direction_id",
            "delay_category"
        ]
    )
}}


predictions as (
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
        extracted_at,
        {{ mbta_service_date('coalesce(predicted_arrival, predicted_departure)') }} as service_date
    from {{ ref('stg_predictions') }}
    where coalesce(predicted_arrival, predicted_departure) is not null
),

schedules as (
    select
        trip_id,
        stop_id,
        scheduled_arrival,
        scheduled_departure,
        stop_sequence,
        timepoint,
        {{ mbta_service_date('coalesce(scheduled_arrival, scheduled_departure)') }} as service_date
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

with_delay as (
    select
        p.prediction_id,
        p.route_id,
        p.stop_id,
        p.trip_id,
        p.vehicle_id,
        p.direction_id,
        p.stop_sequence,
        p.service_date,

        -- Scheduled times
        sch.scheduled_arrival,
        sch.scheduled_departure,
        sch.timepoint,

        -- Predicted times
        p.predicted_arrival,
        p.predicted_departure,
        p.arrival_uncertainty,
        p.departure_uncertainty,

        -- Delay calculation
        case
            when p.predicted_arrival is not null and sch.scheduled_arrival is not null then
                {{ timestamp_diff_seconds('sch.scheduled_arrival', 'p.predicted_arrival') }}
        end as arrival_delay_seconds,

        case
            when p.predicted_departure is not null and sch.scheduled_departure is not null then
                {{ timestamp_diff_seconds('sch.scheduled_departure', 'p.predicted_departure') }}
        end as departure_delay_seconds,

        p.schedule_relationship,
        p.status,
        p.revenue,
        p.update_type,
        p.extracted_at

    from predictions p

    left join schedules sch
        on p.trip_id = sch.trip_id
        and p.stop_id = sch.stop_id
        -- KEY FIX: only match predictions to same service day schedules
        and p.service_date = sch.service_date
),

normalized as (
    select
        prediction_id,
        route_id,
        stop_id,
        trip_id,
        vehicle_id,
        direction_id,
        stop_sequence,
        service_date,
        scheduled_arrival,
        scheduled_departure,
        timepoint,
        predicted_arrival,
        predicted_departure,
        arrival_uncertainty,
        departure_uncertainty,
        coalesce(arrival_delay_seconds, departure_delay_seconds) as delay_seconds,
        schedule_relationship,
        status,
        revenue,
        update_type,
        extracted_at
    from with_delay
),

classified as (
    select
        *,

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
        case when delay_seconds > 300 then true else false end as is_significantly_late

    from normalized
    -- Filter out rows where no schedule match was found
    where delay_seconds is not null
    -- Sanity check: delay should be reasonable (-30min to +60min)
    and delay_seconds between -1800 and 3600
),

enriched as (
    select
        c.prediction_id,
        c.route_id,
        r.route_name,
        r.route_type,
        r.route_type_desc,
        c.stop_id,
        s.stop_name,
        s.municipality,
        s.latitude,
        s.longitude,
        c.trip_id,
        c.vehicle_id,
        c.direction_id,
        c.stop_sequence,
        c.service_date,
        c.scheduled_arrival,
        c.scheduled_departure,
        c.timepoint,
        c.predicted_arrival,
        c.predicted_departure,
        c.arrival_uncertainty,
        c.departure_uncertainty,
        c.delay_seconds,
        c.schedule_relationship,
        c.status,
        c.revenue,
        c.update_type,
        c.extracted_at,
        c.delay_category,
        c.is_late,
        c.is_significantly_late
    from classified c

    left join routes r
        on c.route_id = r.route_id

    left join stops s
        on c.stop_id = s.stop_id
)

select * from enriched
