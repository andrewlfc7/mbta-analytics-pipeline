{% macro mbta_service_date(timestamp_expr) %}
    DATE(
        CASE
            WHEN EXTRACT(
                HOUR FROM DATETIME({{ timestamp_expr }}, "America/New_York")
            ) < 3
            THEN DATETIME_SUB(
                DATETIME({{ timestamp_expr }}, "America/New_York"),
                INTERVAL 1 DAY
            )
            ELSE DATETIME({{ timestamp_expr }}, "America/New_York")
        END
    )
{% endmacro %}
