"""Tests for ingestion extractors — validate parsing, schema, and output."""

import shutil
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import polars as pl
import pytest


class TestBaseExtractorParsing:
    """Test JSON:API response parsing."""

    def test_parse_flattens_attributes(self, sample_routes_response):
        """Attributes should be flattened to top-level keys."""
        from src.ingestion.base import BaseExtractor

        # Create a minimal concrete implementation for testing
        class DummyExtractor(BaseExtractor):
            entity_name = "test"
            endpoint = "/test"

            def to_dataframe(self, records):
                return pl.DataFrame(records)

        extractor = DummyExtractor()
        records = extractor._parse_response(sample_routes_response)

        assert len(records) == 2
        assert records[0]["id"] == "Red"
        assert records[0]["long_name"] == "Red Line"
        assert records[0]["color"] == "DA291C"

    def test_parse_flattens_relationships(self, sample_routes_response):
        """Relationship IDs should be extracted as {rel_name}_id."""
        from src.ingestion.base import BaseExtractor

        class DummyExtractor(BaseExtractor):
            entity_name = "test"
            endpoint = "/test"

            def to_dataframe(self, records):
                return pl.DataFrame(records)

        extractor = DummyExtractor()
        records = extractor._parse_response(sample_routes_response)

        assert records[0]["line_id"] == "line-Red"
        assert records[1]["line_id"] == "line-Green"

    def test_parse_handles_empty_response(self):
        """Empty response should return empty list."""
        from src.ingestion.base import BaseExtractor

        class DummyExtractor(BaseExtractor):
            entity_name = "test"
            endpoint = "/test"

            def to_dataframe(self, records):
                return pl.DataFrame(records)

        extractor = DummyExtractor()
        records = extractor._parse_response({"data": []})
        assert records == []

    def test_parse_handles_null_relationship(self, sample_stops_response):
        """Null relationships should not crash."""
        from src.ingestion.base import BaseExtractor

        class DummyExtractor(BaseExtractor):
            entity_name = "test"
            endpoint = "/test"

            def to_dataframe(self, records):
                return pl.DataFrame(records)

        extractor = DummyExtractor()
        records = extractor._parse_response(sample_stops_response)

        assert len(records) == 1
        # parent_station is None so should not create a key
        assert records[0].get("parent_station_id") is None


class TestPartitioning:
    """Test partition path generation."""

    def test_dimension_path(self):
        from src.utils.partitioning import get_dimension_path

        dt = datetime(2025, 6, 20, 14, 30)
        path = get_dimension_path("./data/raw", "routes", dt)
        assert path == "data/raw/routes/dt=2025-06-20/routes.parquet"

    def test_fact_path(self):
        from src.utils.partitioning import get_fact_path

        dt = datetime(2025, 6, 20, 14, 30)
        path = get_fact_path("./data/raw", "predictions", dt)
        assert path == "data/raw/predictions/dt=2025-06-20/hr=14/predictions.parquet"

    def test_fact_path_midnight(self):
        from src.utils.partitioning import get_fact_path

        dt = datetime(2025, 6, 20, 0, 5)
        path = get_fact_path("./data/raw", "vehicles", dt)
        assert path == "data/raw/vehicles/dt=2025-06-20/hr=00/vehicles.parquet"