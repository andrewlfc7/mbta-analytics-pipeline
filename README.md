
## README.md

```markdown
# MBTA Analytics Pipeline

End-to-end data pipeline ingesting real-time transit data from the [MBTA V3 API](https://api-v3.mbta.com/), transforming it through a medallion architecture, and surfacing analytics via dashboards and predictive models.

![Python](https://img.shields.io/badge/Python-3.12+-blue)
![dbt](https://img.shields.io/badge/dbt-1.11-orange)
![Airflow](https://img.shields.io/badge/Airflow-2.10-green)
![DuckDB](https://img.shields.io/badge/DuckDB-local-yellow)
![BigQuery](https://img.shields.io/badge/BigQuery-production-blue)
![Tests](https://img.shields.io/badge/tests-54%20passed-brightgreen)

## Architecture


MBTA API + Open-Meteo API
        │
        ▼
┌──────────────────┐
│ Python Ingestion │  (httpx, polars, pyarrow)
│ 8 extractors     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Raw Layer        │  Parquet files partitioned by date/hour
│ GCS / Local      │  (Bronze — immutable source of truth)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ DuckDB / BigQuery│  Raw tables loaded from parquet
│                  │
│ dbt Transforms   │
│ ├── Staging      │  (8 models — cleaned, typed, deduped)
│ ├── Intermediate │  (4 models — joins, delay calc, weather)
│ └── Marts        │  (4 models — reliability, performance, alerts)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Analytics        │
│ ├── Notebooks    │  (EDA, feature engineering, ML models)
│ ├── Tableau      │  (dashboards from mart tables)
│ └── ML Models    │  (Random Forest: R²=0.80, AUC=0.97)
└──────────────────┘

```
Orchestration: Apache Airflow (5 DAGs)
Quality: dbt tests (44) + Great Expectations
CI/CD: GitHub Actions
```

## Data Sources

| Source | Type | Frequency | Records |
|--------|------|-----------|---------|
| MBTA /routes | Dimension | Daily | 176 routes |
| MBTA /stops | Dimension | Daily | 10,268 stops |
| MBTA /trips | Dimension | Daily | 17,356 trips |
| MBTA /schedules | Dimension | Daily | 34,804 schedules |
| MBTA /predictions | Fact | Every 5 min | ~1,700/extract |
| MBTA /vehicles | Fact | Every 5 min | ~80/extract |
| MBTA /alerts | Fact | Every 15 min | ~100/extract |
| Open-Meteo | Dimension | Daily | 24 hourly readings |

## Key Metrics

- **Route Reliability Score**: Composite metric (on-time %, significant delay rate, avg delay)
- **Delay Hotspot Score**: Per-stop score combining late rate, severity, and frequency
- **Alert Impact Score**: Severity × entities affected × effect type multiplier
- **Delay Prediction**: Random Forest regression (MAE=81.6s, R²=0.80) and classification (F1=0.81, AUC=0.97)

## Project Structure


mbta-analytics-pipeline/
├── .github/workflows/     CI/CD pipelines
├── dags/                  Airflow DAGs (5 DAGs)
├── src/
│   ├── ingestion/         API extractors (8 entities)
│   ├── loaders/           DuckDB + BigQuery loaders
│   ├── quality/           Validation utilities
│   └── utils/             Config, logging, partitioning
├── dbt_mbta/
│   └── models/
│       ├── staging/       8 models (cleaned raw data)
│       ├── intermediate/  4 models (business logic joins)
│       └── marts/         4 models (analytics-ready)
├── notebooks/
│   ├── 01_eda_routes_and_stops.ipynb
│   ├── 02_eda_delay_patterns.ipynb
│   ├── 03_feature_engineering.ipynb
│   ├── 04_delay_prediction_model.ipynb
│   └── 05_model_evaluation.ipynb
├── tests/                 54 tests (unit + API contract)
├── docker-compose.yml     Airflow local deployment
└── data/                  Local raw parquet + DuckDB


## Airflow DAGs

| DAG | Schedule | Tasks | Description |
|-----|----------|-------|-------------|
| `daily_dimensions` | Daily 6am | 5 | Routes, stops, trips, schedules, weather |
| `realtime_facts` | Every 5 min | 2 | Predictions, vehicles |
| `alerts` | Every 15 min | 1 | Service alerts |
| `dbt_transforms` | Hourly | 4 | staging → intermediate → marts → test |
| `data_quality` | Daily 7am | 2 | Freshness checks, row count validation |

## dbt Models

### Staging (8 models)
Clean, type, and deduplicate raw data. Schema tests enforce not-null, unique, accepted values, and referential integrity.

### Intermediate (4 models)
- `int_scheduled_vs_actual` — Joins predictions to schedules, computes delay_seconds and delay categories
- `int_stop_activity` — Vehicle counts, occupancy metrics per stop per hour
- `int_alert_impacts` — Alert duration, severity classification, active status
- `int_weather_transit` — Weather conditions joined to predictions for delay correlation

### Marts (4 models)
- `mart_route_reliability` — On-time %, delay percentiles, reliability score per route
- `mart_stop_performance` — Delay hotspots, vehicle frequency, occupancy by stop
- `mart_delay_analysis` — Delay breakdowns by route × hour × day of week
- `mart_alert_summary` — Alert frequency, impact scoring, affected entities

## ML Models

| Task | Model | Metric | Score |
|------|-------|--------|-------|
| Delay Regression | Random Forest | R² | 0.80 |
| Delay Regression | Random Forest | MAE | 81.6s |
| Late Classification | Random Forest | AUC | 0.97 |
| Late Classification | Random Forest | F1 | 0.81 |

Top features: historical stop delay, route delay, route late rate, prediction uncertainty.

## Setup

### Local Development

```bash
# Clone
git clone https://github.com/andrewlfc7/mbta-analytics-pipeline.git
cd mbta-analytics-pipeline

# Python environment
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Environment variables
cp .env.example .env
# Add MBTA_API_KEY (optional, increases rate limits)

# Run extraction
python -m src.ingestion.run_all

# Load into DuckDB
python -m src.loaders.duckdb_loader

# dbt (requires Python 3.12)
python3.12 -m venv .venv-dbt
source .venv-dbt/bin/activate
pip install dbt-duckdb
cd dbt_mbta && dbt deps && dbt run && dbt test
```

### Airflow (Docker)

```bash
docker compose build
docker compose up -d
# UI: http://localhost:8080 (admin/admin)
```

### Run Tests

```bash
# Unit tests
pytest tests/test_ingestion.py tests/test_extractors.py tests/test_loaders.py -v

# API contract tests
pytest tests/test_api_contract.py -v -m contract

# All tests
pytest -v
```

```
## Tech Stack

| Layer | Technology |
|-------|-----------|
| Ingestion | Python, httpx, polars, pyarrow |
| Storage (Raw) | Parquet on local / GCS |
| Warehouse (Local) | DuckDB |
| Warehouse (Prod) | BigQuery |
| Transforms | dbt (staging → intermediate → marts) |
| Orchestration | Apache Airflow |
| Quality | dbt tests, Great Expectations |
| ML | scikit-learn, Random Forest |
| Visualization | Plotly, Tableau |
| CI/CD | GitHub Actions, Docker |
| Infrastructure | Docker Compose, GCP |
```