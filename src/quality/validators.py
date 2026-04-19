"""Validators for each raw entity — define expected schema and quality rules."""

import polars as pl

from src.quality.expectations import ExpectationResult, SuiteResult
from src.utils.logger import get_logger

logger = get_logger("data_quality")


# ---------------------------------------------------------------------------
# Expected schemas for each raw entity
# ---------------------------------------------------------------------------

EXPECTED_SCHEMAS: dict[str, dict[str, list[str]]] = {
    "routes": {
        "required_columns": [
            "route_id", "long_name", "route_type", "route_type_desc",
            "color", "description",
        ],
        "not_null_columns": ["route_id", "long_name", "route_type"],
        "unique_columns": ["route_id"],
    },
    "stops": {
        "required_columns": [
            "stop_id", "name", "latitude", "longitude",
            "municipality", "location_type",
        ],
        "not_null_columns": ["stop_id", "name"],
        "unique_columns": ["stop_id"],
    },
    "trips": {
        "required_columns": [
            "trip_id", "route_id", "direction_id", "service_id",
        ],
        "not_null_columns": ["trip_id", "route_id"],
        "unique_columns": ["trip_id"],
    },
    "schedules": {
        "required_columns": [
            "schedule_id", "trip_id", "stop_id", "route_id",
            "stop_sequence",
        ],
        "not_null_columns": ["schedule_id", "trip_id", "stop_id"],
        "unique_columns": ["schedule_id"],
    },
    "predictions": {
        "required_columns": [
            "prediction_id", "route_id", "stop_id", "trip_id",
            "extracted_at",
        ],
        "not_null_columns": ["prediction_id", "route_id", "extracted_at"],
        "unique_columns": [],
    },
    "vehicles": {
        "required_columns": [
            "vehicle_id", "route_id", "latitude", "longitude",
            "current_status", "extracted_at",
        ],
        "not_null_columns": ["vehicle_id", "route_id", "extracted_at"],
        "unique_columns": [],
    },
    "alerts": {
        "required_columns": [
            "alert_id", "cause", "effect", "severity",
            "header", "extracted_at",
        ],
        "not_null_columns": ["alert_id", "severity", "extracted_at"],
        "unique_columns": [],  # alerts are appended, duplicates expected
    },
    "weather": {
        "required_columns": [
            "timestamp", "temperature_2m", "precipitation",
            "wind_speed_10m", "weather_code",
        ],
        "not_null_columns": ["timestamp", "temperature_2m"],
        "unique_columns": ["timestamp"],
    },
}


MINIMUM_ROW_COUNTS: dict[str, int] = {
    "routes": 100,
    "stops": 5000,
    "trips": 1000,
    "schedules": 5000,
    "predictions": 100,
    "vehicles": 10,
    "alerts": 1,
    "weather": 24,
}

# Valid ranges for numeric columns
VALID_RANGES: dict[str, dict[str, tuple[float, float]]] = {
    "stops": {
        "latitude": (41.0, 43.0),
        "longitude": (-72.0, -70.0),
    },
    "vehicles": {
        "latitude": (41.0, 43.0),
        "longitude": (-72.0, -70.0),
    },
    "weather": {
        "temperature_2m": (-40.0, 120.0),
        "precipitation": (0.0, 500.0),
        "wind_speed_10m": (0.0, 200.0),
    },
    "routes": {
        "route_type": (0, 4),
    },
}


def validate_dataframe(entity: str, df: pl.DataFrame) -> SuiteResult:
    """Run all quality checks on a Polars DataFrame."""
    suite = SuiteResult(entity=entity)
    schema = EXPECTED_SCHEMAS.get(entity, {})

    # 1. Row count check
    min_rows = MINIMUM_ROW_COUNTS.get(entity, 1)
    suite.results.append(ExpectationResult(
        name="min_row_count",
        passed=len(df) >= min_rows,
        expected=f">= {min_rows}",
        actual=len(df),
    ))

    # 2. Required columns
    for col in schema.get("required_columns", []):
        suite.results.append(ExpectationResult(
            name=f"column_exists:{col}",
            passed=col in df.columns,
            expected="present",
            actual="present" if col in df.columns else "missing",
        ))

    # 3. Not-null checks
    for col in schema.get("not_null_columns", []):
        if col in df.columns:
            null_count = df[col].null_count()
            null_pct = (null_count / len(df) * 100) if len(df) > 0 else 0
            suite.results.append(ExpectationResult(
                name=f"not_null:{col}",
                passed=null_count == 0,
                expected=0,
                actual=null_count,
                details=f"{null_pct:.1f}% null",
            ))

    # 4. Uniqueness checks
    for col in schema.get("unique_columns", []):
        if col in df.columns:
            total = len(df)
            unique = df[col].n_unique()
            suite.results.append(ExpectationResult(
                name=f"unique:{col}",
                passed=unique == total,
                expected=total,
                actual=unique,
                details=f"{total - unique} duplicates",
            ))

    # 5. Valid range checks
    ranges = VALID_RANGES.get(entity, {})
    for col, (min_val, max_val) in ranges.items():
        if col in df.columns:
            col_min = df[col].drop_nulls().min()
            col_max = df[col].drop_nulls().max()
            in_range = True
            if col_min is not None and col_min < min_val:
                in_range = False
            if col_max is not None and col_max > max_val:
                in_range = False
            suite.results.append(ExpectationResult(
                name=f"valid_range:{col}",
                passed=in_range,
                expected=f"[{min_val}, {max_val}]",
                actual=f"[{col_min}, {col_max}]",
            ))

    # 6. No completely empty DataFrame
    suite.results.append(ExpectationResult(
        name="not_empty",
        passed=len(df) > 0,
        expected="> 0 rows",
        actual=f"{len(df)} rows",
    ))

    logger.info(
        "validation_complete",
        entity=entity,
        passed=suite.passed,
        checks=len(suite.results),
        failures=suite.fail_count,
    )

    return suite


def validate_parquet(entity: str, path: str) -> SuiteResult:
    """Validate a parquet file or glob pattern."""
    try:
        df = pl.read_parquet(path)
        return validate_dataframe(entity, df)
    except Exception as e:
        suite = SuiteResult(entity=entity)
        suite.results.append(ExpectationResult(
            name="file_readable",
            passed=False,
            expected="readable parquet",
            actual=str(e),
        ))
        return suite


def validate_all_local(raw_path: str = "data/raw") -> dict[str, SuiteResult]:
    """Validate all entities from local parquet files."""
    from pathlib import Path

    results = {}
    for entity in EXPECTED_SCHEMAS:
        entity_path = Path(raw_path) / entity
        parquet_files = list(entity_path.glob("**/*.parquet"))

        if not parquet_files:
            suite = SuiteResult(entity=entity)
            suite.results.append(ExpectationResult(
                name="files_exist",
                passed=False,
                expected=">= 1 file",
                actual="0 files",
            ))
            results[entity] = suite
            continue

        # Read all parquet files for this entity
        dfs = [pl.read_parquet(str(f)) for f in parquet_files]
        df = pl.concat(dfs, how="diagonal_relaxed")
        results[entity] = validate_dataframe(entity, df)

    return results


def validate_all_bigquery() -> dict[str, SuiteResult]:
    """Validate all entities from BigQuery tables."""
    from google.cloud import bigquery

    from src.config import get_config

    config = get_config()
    client = bigquery.Client(project=config.gcp.project_id)
    dataset = config.gcp.dataset

    table_map = {
        "routes": "raw_routes",
        "stops": "raw_stops",
        "trips": "raw_trips",
        "schedules": "raw_schedules",
        "predictions": "raw_predictions",
        "vehicles": "raw_vehicles",
        "alerts": "raw_alerts",
        "weather": "raw_weather",
    }

    results = {}
    for entity, table_name in table_map.items():
        table_id = f"{config.gcp.project_id}.{dataset}.{table_name}"
        try:
            query = f"SELECT * FROM `{table_id}`"
            df = pl.from_arrow(client.query(query).to_arrow())
            results[entity] = validate_dataframe(entity, df)
        except Exception as e:
            suite = SuiteResult(entity=entity)
            suite.results.append(ExpectationResult(
                name="table_readable",
                passed=False,
                expected="readable table",
                actual=str(e),
            ))
            results[entity] = suite

    return results
