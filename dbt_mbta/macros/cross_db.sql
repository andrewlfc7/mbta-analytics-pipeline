{% macro get_day_of_week(col) %}
  {% if target.type == 'bigquery' %}
    EXTRACT(DAYOFWEEK FROM {{ col }})
  {% else %}
    extract(dow from {{ col }})
  {% endif %}
{% endmacro %}

{% macro is_weekend(col) %}
  {% if target.type == 'bigquery' %}
    EXTRACT(DAYOFWEEK FROM {{ col }}) in (1, 7)
  {% else %}
    extract(dow from {{ col }}) in (0, 6)
  {% endif %}
{% endmacro %}

{% macro median_val(col) %}
  {% if target.type == 'bigquery' %}
    APPROX_QUANTILES({{ col }}, 2)[OFFSET(1)]
  {% else %}
    median({{ col }})
  {% endif %}
{% endmacro %}

{% macro percentile_val(col, pct) %}
  {% if target.type == 'bigquery' %}
    APPROX_QUANTILES({{ col }}, 100)[OFFSET({{ (pct * 100) | int }})]
  {% else %}
    quantile_cont({{ col }}, {{ pct }})
  {% endif %}
{% endmacro %}

{% macro timestamp_diff_seconds(start_col, end_col) %}
  {% if target.type == 'bigquery' %}
    cast(TIMESTAMP_DIFF(cast({{ end_col }} as timestamp), cast({{ start_col }} as timestamp), SECOND) as int64)
  {% else %}
    cast(
      extract(epoch from cast({{ end_col }} as timestamp))
      - extract(epoch from cast({{ start_col }} as timestamp))
      as bigint
    )
  {% endif %}
{% endmacro %}

{% macro array_len(col) %}
  {% if target.type == 'bigquery' %}
    ARRAY_LENGTH({{ col }})
  {% else %}
    len({{ col }})
  {% endif %}
{% endmacro %}

{% macro parse_ts(col) %}
  {% if target.type == 'bigquery' %}
    PARSE_TIMESTAMP('%Y-%m-%dT%H:%M', {{ col }})
  {% else %}
    cast({{ col }} as timestamp)
  {% endif %}
{% endmacro %}
