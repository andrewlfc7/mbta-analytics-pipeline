-- Heatmap: Average delay by day of week and hour of day
WITH delay_data AS (
    SELECT
        FORMAT_DATE('%A', date) AS day_of_week,
        EXTRACT(DAYOFWEEK FROM date) AS day_num,
        EXTRACT(HOUR FROM scheduled_time) AS hour,
        delay_seconds,
        CASE WHEN delay_seconds > 300 THEN 1 ELSE 0 END AS is_late
    FROM
        `{project}.{dataset}.mart_delay_analysis`
    WHERE
        date >= DATE_SUB(CURRENT_DATE(), INTERVAL @period_days DAY)
        AND (
            @route_filter = 'all'
            OR route_id = @route_filter
        )
        AND (
            @direction = 'all'
            OR direction = @direction
        )
)

SELECT
    day_of_week,
    day_num,
    hour,
    ROUND(AVG(delay_seconds) / 60.0, 1) AS avg_delay_minutes,
    ROUND(
        APPROX_QUANTILES(delay_seconds, 100)[OFFSET(50)] / 60.0, 1
    ) AS median_delay_minutes,
    COUNT(*) AS trip_count,
    ROUND(
        COUNTIF(is_late = 1) / COUNT(*) * 100, 1
    ) AS pct_late
FROM
    delay_data
GROUP BY
    day_of_week, day_num, hour
ORDER BY
    day_num, hour