"""Tests for DuckDB loader."""

from pathlib import Path

import polars as pl
import pytest

from src.config import AppConfig, LocalConfig
from src.loaders.bigquery_loader import BigQueryLoader
from src.loaders.duckdb_loader import DuckDBLoader


@pytest.fixture
def test_dir(tmp_path):
    """Create a temporary directory structure with test parquet files."""
    raw_path = tmp_path / "raw"

    # Create routes dimension
    routes_dir = raw_path / "routes" / "dt=2026-04-19"
    routes_dir.mkdir(parents=True)
    pl.DataFrame(
        {
            "route_id": ["Red", "Orange"],
            "long_name": ["Red Line", "Orange Line"],
            "route_type": [1, 1],
        }
    ).write_parquet(str(routes_dir / "routes.parquet"))

    # Create predictions fact (two hourly partitions)
    pred_dir_1 = raw_path / "predictions" / "dt=2026-04-19" / "hr=10"
    pred_dir_1.mkdir(parents=True)
    pl.DataFrame(
        {
            "prediction_id": ["pred-1", "pred-2"],
            "route_id": ["Red", "Red"],
            "arrival_time": ["2026-04-19T10:05:00", "2026-04-19T10:10:00"],
            "extracted_at": ["2026-04-19T10:00:00Z", "2026-04-19T10:00:00Z"],
        }
    ).write_parquet(str(pred_dir_1 / "predictions.parquet"))

    pred_dir_2 = raw_path / "predictions" / "dt=2026-04-19" / "hr=11"
    pred_dir_2.mkdir(parents=True)
    pl.DataFrame(
        {
            "prediction_id": ["pred-3"],
            "route_id": ["Orange"],
            "arrival_time": ["2026-04-19T11:05:00"],
            "extracted_at": ["2026-04-19T11:00:00Z"],
        }
    ).write_parquet(str(pred_dir_2 / "predictions.parquet"))

    return tmp_path


@pytest.fixture
def test_config(test_dir) -> AppConfig:
    return AppConfig(
        env="local",
        local=LocalConfig(
            raw_path=Path(test_dir / "raw"),
            db_path=Path(test_dir / "test.duckdb"),
        ),
    )


@pytest.fixture
def loader(test_config) -> DuckDBLoader:
    return DuckDBLoader(config=test_config)


class TestDuckDBLoader:
    def test_load_dimension_replace(self, loader):
        """Dimensions should replace on each load."""
        count = loader.load_parquet("routes")
        assert count == 2

        # Load again — should still be 2 (replaced, not appended)
        count = loader.load_parquet("routes")
        assert count == 2

    def test_load_fact_append(self, loader):
        """Facts should append across partitions."""
        count = loader.load_parquet("predictions")
        # 2 from hr=10 + 1 from hr=11
        assert count == 3

    def test_load_fact_is_idempotent(self, loader, test_dir):
        """Loading the same fact parquet twice should not duplicate rows."""
        parquet_path = (
            test_dir
            / "raw"
            / "predictions"
            / "dt=2026-04-19"
            / "hr=10"
            / "predictions.parquet"
        )

        count = loader.load_parquet("predictions", parquet_path=str(parquet_path))
        assert count == 2

        count = loader.load_parquet("predictions", parquet_path=str(parquet_path))
        assert count == 2

    def test_load_fact_appends_new_snapshot(self, loader, test_dir):
        """Same IDs at a new extraction timestamp should load as new observations."""
        first_path = (
            test_dir
            / "raw"
            / "predictions"
            / "dt=2026-04-19"
            / "hr=10"
            / "predictions.parquet"
        )
        second_dir = test_dir / "raw" / "predictions" / "dt=2026-04-19" / "hr=12"
        second_dir.mkdir(parents=True)
        second_path = second_dir / "predictions.parquet"
        pl.DataFrame(
            {
                "prediction_id": ["pred-1", "pred-2"],
                "route_id": ["Red", "Red"],
                "arrival_time": ["2026-04-19T12:05:00", "2026-04-19T12:10:00"],
                "extracted_at": ["2026-04-19T12:00:00Z", "2026-04-19T12:00:00Z"],
            }
        ).write_parquet(str(second_path))

        count = loader.load_parquet("predictions", parquet_path=str(first_path))
        assert count == 2

        count = loader.load_parquet("predictions", parquet_path=str(second_path))
        assert count == 4

    def test_load_fact_dedupes_source_key_collisions(self, loader, test_dir):
        """Duplicate keys inside one source file should be collapsed in raw."""
        duplicate_dir = test_dir / "raw" / "predictions" / "dt=2026-04-19" / "hr=12"
        duplicate_dir.mkdir(parents=True)
        duplicate_path = duplicate_dir / "predictions.parquet"
        pl.DataFrame(
            {
                "prediction_id": ["pred-1", "pred-1"],
                "route_id": ["Red", "Red"],
                "arrival_time": ["2026-04-19T12:05:00", "2026-04-19T12:06:00"],
                "extracted_at": ["2026-04-19T12:00:00Z", "2026-04-19T12:00:00Z"],
            }
        ).write_parquet(str(duplicate_path))

        count = loader.load_parquet("predictions", parquet_path=str(duplicate_path))
        assert count == 1

        duplicate_groups = loader.query(
            """
            SELECT count(*)
            FROM (
                SELECT prediction_id, extracted_at
                FROM raw_mbta.raw_predictions
                GROUP BY 1, 2
                HAVING count(*) > 1
            )
            """
        )[0][0]
        assert duplicate_groups == 0

    def test_dedupe_entity_cleans_existing_raw_duplicates(self, loader):
        """Existing duplicate raw rows can be cleaned without a new load."""
        conn = loader.get_connection()
        try:
            loader._create_schema(conn)
            conn.execute(
                """
                CREATE TABLE raw_mbta.raw_predictions AS
                SELECT *
                FROM (
                    VALUES
                        ('pred-1', 'Red', '2026-04-19T10:00:00Z'),
                        ('pred-1', 'Red', '2026-04-19T10:00:00Z'),
                        ('pred-1', 'Red', '2026-04-19T10:05:00Z')
                ) AS t(prediction_id, route_id, extracted_at)
                """
            )
        finally:
            conn.close()

        count = loader.dedupe_entity("predictions")
        assert count == 2

        duplicate_groups = loader.query(
            """
            SELECT count(*)
            FROM (
                SELECT prediction_id, extracted_at
                FROM raw_mbta.raw_predictions
                GROUP BY 1, 2
                HAVING count(*) > 1
            )
            """
        )[0][0]
        assert duplicate_groups == 0

    def test_query(self, loader):
        """Should be able to query loaded data."""
        loader.load_parquet("routes")
        result = loader.query("SELECT route_id FROM raw_mbta.raw_routes ORDER BY route_id")
        assert result == [("Orange",), ("Red",)]

    def test_table_stats(self, loader):
        """Should return accurate row counts."""
        loader.load_parquet("routes")
        loader.load_parquet("predictions")
        stats = loader.table_stats()

        assert stats["raw_routes"] == 2
        assert stats["raw_predictions"] == 3

    def test_unknown_entity_raises(self, loader):
        with pytest.raises(ValueError, match="Unknown entity"):
            loader.load_parquet("nonexistent")

    def test_no_files_returns_zero(self, loader):
        """Missing entity directory should return 0, not crash."""
        results = loader.load_all()
        # stops has no files in our test fixture
        assert results["stops"] == 0

    def test_load_all(self, loader):
        """Should load all available entities."""
        results = loader.load_all()
        assert results["routes"] == 2
        assert results["predictions"] == 3
        # Entities without files should be 0
        assert results["stops"] == 0


class TestBigQueryLoader:
    def test_deduped_source_query_uses_keys_not_distinct_star(self):
        loader = BigQueryLoader.__new__(BigQueryLoader)

        sql = loader._deduped_source_query(
            "project.raw_mbta.load_staging_predictions_123",
            ["prediction_id", "extracted_at"],
        )

        assert "ROW_NUMBER() OVER" in sql
        assert "PARTITION BY `prediction_id`, `extracted_at`" in sql
        assert "SELECT DISTINCT *" not in sql
        assert "FROM `project.raw_mbta.load_staging_predictions_123`" in sql
