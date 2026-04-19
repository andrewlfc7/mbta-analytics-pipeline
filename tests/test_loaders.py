"""Tests for DuckDB loader."""

from pathlib import Path

import polars as pl
import pytest

from src.config import AppConfig, LocalConfig
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
        }
    ).write_parquet(str(pred_dir_1 / "predictions.parquet"))

    pred_dir_2 = raw_path / "predictions" / "dt=2026-04-19" / "hr=11"
    pred_dir_2.mkdir(parents=True)
    pl.DataFrame(
        {
            "prediction_id": ["pred-3"],
            "route_id": ["Orange"],
            "arrival_time": ["2026-04-19T11:05:00"],
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
