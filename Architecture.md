## Full End-to-End Architecture

---

### Data Flow — Complete Picture

```
┌─────────────┐
│  MBTA V3 API │
│  Open-Meteo  │ (weather enrichment)
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│  INGESTION LAYER (Python)                     │
│                                               │
│  extract → validate schema → convert to       │
│  parquet → write to raw layer                 │
│                                               │
│  Local:  ./data/raw/                          │
│  GCP:    gs://mbta-raw/                       │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  RAW LAYER (Bronze)                           │
│  Parquet files, partitioned by date/hour      │
│                                               │
│  raw/                                         │
│  ├── routes/dt=2025-06-20/routes.parquet      │
│  ├── stops/dt=2025-06-20/stops.parquet        │
│  ├── trips/dt=2025-06-20/trips.parquet        │
│  ├── schedules/dt=2025-06-20/schedules.parquet│
│  ├── predictions/                             │
│  │   └── dt=2025-06-20/hr=14/                 │
│  │       └── predictions.parquet              │
│  ├── vehicles/                                │
│  │   └── dt=2025-06-20/hr=14/                 │
│  │       └── vehicles.parquet                 │
│  ├── alerts/dt=2025-06-20/alerts.parquet      │
│  └── weather/dt=2025-06-20/weather.parquet    │
│                                               │
│  Local:  ./data/raw/                          │
│  GCP:    gs://mbta-raw-{env}/                 │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  LOAD LAYER                                   │
│  Parquet → DuckDB (local) / BigQuery (GCP)    │
│                                               │
│  raw_mbta schema/dataset                      │
│  ├── raw_routes                               │
│  ├── raw_stops                                │
│  ├── raw_trips                                │
│  ├── raw_schedules                            │
│  ├── raw_predictions                          │
│  ├── raw_vehicles                             │
│  ├── raw_alerts                               │
│  └── raw_weather                              │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  TRANSFORM LAYER (dbt)                        │
│                                               │
│  staging_mbta                                 │
│  ├── stg_routes       (typed, deduped)        │
│  ├── stg_stops        (lat/lng cast, nulls)   │
│  ├── stg_trips        (joined to routes)      │
│  ├── stg_schedules    (timestamps parsed)     │
│  ├── stg_predictions  (predicted vs scheduled)│
│  ├── stg_vehicles     (position, status)      │
│  ├── stg_alerts       (severity, window)      │
│  └── stg_weather      (hourly, typed)         │
│                                               │
│  intermediate_mbta                            │
│  ├── int_scheduled_vs_actual                  │
│  │   (delay_seconds, is_late, route context)  │
│  ├── int_stop_activity                        │
│  │   (vehicle counts per stop per hour)       │
│  ├── int_alert_impacts                        │
│  │   (alerts joined to routes/stops)          │
│  └── int_weather_transit                      │
│      (weather joined to predictions by hour)  │
│                                               │
│  marts_mbta                                   │
│  ├── mart_route_reliability                   │
│  ├── mart_stop_performance                    │
│  ├── mart_delay_analysis                      │
│  └── mart_alert_summary                       │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  DATA QUALITY LAYER                           │
│                                               │
│  dbt tests (schema.yml)                       │
│  ├── not_null, unique, accepted_values        │
│  ├── relationships (FK integrity)             │
│  └── custom: valid delay range, no future ts  │
│                                               │
│   QUALITY checks                              │
│  ├── raw layer expectations                   │
│  │   (schema shape, column types, row counts) │
│  ├── freshness checks                         │
│  └── anomaly detection (row count drift)      │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  ORCHESTRATION (Airflow)                      │
│                                               │
│  dag_daily_dimensions (6am daily)             │
│  ├── extract_routes                           │
│  ├── extract_stops                            │
│  ├── extract_trips                            │
│  ├── extract_schedules                        │
│  ├── extract_weather                          │
│  ├── ge_validate_dimensions                   │
│  └── load_dimensions_to_warehouse             │
│                                               │
│  dag_realtime_facts (every 5 min)             │
│  ├── extract_predictions                      │
│  ├── extract_vehicles                         │
│  ├── ge_validate_facts                        │
│  └── load_facts_to_warehouse                  │
│                                               │
│  dag_alerts (every 15 min)                    │
│  ├── extract_alerts                           │
│  └── load_alerts_to_warehouse                 │
│                                               │
│  dag_dbt_transforms (hourly)                  │
│  ├── dbt run --select staging                 │
│  ├── dbt run --select intermediate            │
│  ├── dbt run --select marts                   │
│  └── dbt test                                 │
│                                               │
│  dag_data_quality (daily)                     │
│  └── ge_full_checkpoint_run                   │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  ANALYTICS LAYER                              │
│                                               │
│  Notebooks (EDA + ML)                         │
│  ├── 01_eda_routes_stops.ipynb                │
│  ├── 02_eda_delay_patterns.ipynb              │
│  ├── 03_feature_engineering.ipynb             │
│  ├── 04_delay_prediction_model.ipynb          │
│  └── 05_model_evaluation.ipynb                │
│                                               │
│  Tableau Public                               │
│  ├── Route reliability dashboard              │
│  ├── Delay hotspot map                        │
│  ├── Peak hour performance                    │
│  └── Alert impact analysis                    │
└──────────────────────────────────────────────┘
```

---

### CI/CD — GitHub Actions

```
.github/workflows/

├── ci.yml (runs on every PR)
│   ├── lint (ruff)
│   ├── type check (mypy)
│   ├── unit tests (pytest)
│   ├── dbt compile (syntax validation)
│   └── dbt test (against DuckDB test fixture)
│
├── cd.yml (runs on merge to main)
│   ├── build Docker image
│   ├── push to GCP Artifact Registry
│   ├── SSH into e2-micro VM
│   ├── pull latest image
│   └── restart Airflow containers
│
└── data_quality.yml (scheduled daily)
    └── trigger GE checkpoint + alert on failure
```

---

### Environment Toggle

```python
# config.py
import os

ENV = os.getenv("MBTA_ENV", "local")  # "local" or "gcp"

CONFIG = {
    "local": {
        "raw_path": "./data/raw",
        "warehouse": "duckdb",
        "db_path": "./data/mbta.duckdb",
    },
    "gcp": {
        "raw_path": "gs://mbta-raw-prod",
        "warehouse": "bigquery",
        "project": "mbta-analytics",
        "dataset": "raw_mbta",
    },
}
```

---

### Repo Structure (Final)

```
mbta-analytics-pipeline/
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── cd.yml
│
├── dags/
│   ├── dag_daily_dimensions.py
│   ├── dag_realtime_facts.py
│   ├── dag_alerts.py
│   ├── dag_dbt_transforms.py
│   └── dag_data_quality.py
│
├── src/
│   ├── __init__.py
│   ├── config.py
│   ├── ingestion/
│   │   ├── __init__.py
│   │   ├── base.py          (base extractor class)
│   │   ├── routes.py
│   │   ├── stops.py
│   │   ├── trips.py
│   │   ├── schedules.py
│   │   ├── predictions.py
│   │   ├── vehicles.py
│   │   ├── alerts.py
│   │   └── weather.py
│   ├── loaders/
│   │   ├── __init__.py
│   │   ├── duckdb_loader.py
│   │   └── bigquery_loader.py
│   ├── quality/
│   │   ├── __init__.py
│   │   └── validators.py
│   └── utils/
│       ├── __init__.py
│       ├── logger.py
│       └── partitioning.py
│
├── dbt_mbta/
│   ├── dbt_project.yml
│   ├── profiles.yml
│   ├── packages.yml
│   ├── models/
│   │   ├── staging/
│   │   │   ├── _staging.yml      (schema tests)
│   │   │   ├── stg_routes.sql
│   │   │   ├── stg_stops.sql
│   │   │   ├── stg_trips.sql
│   │   │   ├── stg_schedules.sql
│   │   │   ├── stg_predictions.sql
│   │   │   ├── stg_vehicles.sql
│   │   │   ├── stg_alerts.sql
│   │   │   └── stg_weather.sql
│   │   ├── intermediate/
│   │   │   ├── _intermediate.yml
│   │   │   ├── int_scheduled_vs_actual.sql
│   │   │   ├── int_stop_activity.sql
│   │   │   ├── int_alert_impacts.sql
│   │   │   └── int_weather_transit.sql
│   │   └── marts/
│   │       ├── _marts.yml
│   │       ├── mart_route_reliability.sql
│   │       ├── mart_stop_performance.sql
│   │       ├── mart_delay_analysis.sql
│   │       └── mart_alert_summary.sql
│   ├── tests/
│   │   └── custom/
│   │       ├── test_no_future_predictions.sql
│   │       └── test_valid_delay_range.sql
│   ├── macros/
│   │   └── generate_schema_name.sql
│   └── seeds/
│       └── route_type_mapping.csv
│
├── great_expectations/
│   ├── great_expectations.yml
│   ├── expectations/
│   │   ├── raw_routes_suite.json
│   │   ├── raw_predictions_suite.json
│   │   └── raw_vehicles_suite.json
│   └── checkpoints/
│       ├── raw_checkpoint.yml
│       └── daily_checkpoint.yml
│
├── notebooks/
│   ├── 01_eda_routes_and_stops.ipynb
│   ├── 02_eda_delay_patterns.ipynb
│   ├── 03_feature_engineering.ipynb
│   ├── 04_delay_prediction_model.ipynb
│   └── 05_model_evaluation.ipynb
│
├── ml/
│   ├── __init__.py
│   ├── features.py
│   ├── train.py
│   ├── predict.py
│   └── config.yml
│
├── tableau/
│   └── screenshots/
│
├── docs/
│   ├── architecture.md
│   ├── data_dictionary.md
│   └── lineage_diagram.png
│
├── tests/
│   ├── __init__.py
│   ├── test_ingestion.py
│   ├── test_loaders.py
│   └── test_validators.py
│
├── data/                     (gitignored)
│   ├── raw/
│   └── mbta.duckdb
│
├── docker-compose.yml
├── Dockerfile
├── pyproject.toml
├── requirements.txt
├── .env.example
├── .gitignore
├── .pre-commit-config.yaml
└── README.md
```

---

### .gitignore

```
# Data
data/
*.duckdb
*.parquet

# Environment
.env
venv/
.venv/

# Python
__pycache__/
*.pyc
.mypy_cache/
.ruff_cache/

# Airflow
logs/
airflow.db
airflow-webserver.pid

# dbt
dbt_mbta/target/
dbt_mbta/dbt_packages/
dbt_mbta/logs/

# Great Expectations
great_expectations/uncommitted/

# Jupyter
.ipynb_checkpoints/

# OS
.DS_Store

# IDE
.vscode/
.idea/
```

---

### .env.example

```
MBTA_ENV=local
MBTA_API_KEY=optional_for_higher_rate_limits

# GCP (only needed for gcp env)
GCP_PROJECT_ID=mbta-analytics
GCS_BUCKET=mbta-raw-prod
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# Airflow
AIRFLOW__CORE__EXECUTOR=LocalExecutor
AIRFLOW__CORE__LOAD_EXAMPLES=False
AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=sqlite:///airflow.db
```

---

### pyproject.toml (Key Dependencies)

```toml
[project]
name = "mbta-analytics-pipeline"
version = "0.1.0"
requires-python = ">=3.11"

dependencies = [
    "httpx",
    "polars",
    "pyarrow",
    "duckdb",
    "apache-airflow",
    "dbt-duckdb",
    "dbt-bigquery",
    "great-expectations",
    "google-cloud-storage",
    "google-cloud-bigquery",
    "python-dotenv",
    "structlog",
]

[project.optional-dependencies]
dev = [
    "pytest",
    "ruff",
    "mypy",
    "pre-commit",
    "jupyter",
    "plotly",
    "folium",
    "scikit-learn",
    "xgboost",
    "matplotlib",
    "seaborn",
]

[tool.ruff]
line-length = 100
select = ["E", "F", "I", "W"]

[tool.mypy]
python_version = "3.11"
warn_return_any = true
warn_unused_configs = true
```
