"""Shared test fixtures."""

import pytest

from src.config import AppConfig, LocalConfig, MBTAAPIConfig


@pytest.fixture
def test_config() -> AppConfig:
    """Config pointed at test directories."""
    return AppConfig(
        env="local",
        mbta=MBTAAPIConfig(
            base_url="https://api-v3.mbta.com",
            timeout=10,
            max_retries=1,
        ),
        local=LocalConfig(
            raw_path="./data/test_raw",
            db_path="./data/test_mbta.duckdb",
        ),
    )


@pytest.fixture
def sample_routes_response() -> dict:
    """Sample MBTA API response for routes."""
    return {
        "data": [
            {
                "id": "Red",
                "type": "route",
                "attributes": {
                    "color": "DA291C",
                    "description": "Rapid Transit",
                    "direction_destinations": ["Ashmont/Braintree", "Alewife"],
                    "direction_names": ["South", "North"],
                    "fare_class": "Rapid Transit",
                    "long_name": "Red Line",
                    "short_name": "",
                    "sort_order": 10010,
                    "text_color": "FFFFFF",
                    "type": 1,
                },
                "relationships": {
                    "line": {"data": {"id": "line-Red", "type": "line"}},
                },
            },
            {
                "id": "Green-B",
                "type": "route",
                "attributes": {
                    "color": "00843D",
                    "description": "Rapid Transit",
                    "direction_destinations": ["Boston College", "Government Center"],
                    "direction_names": ["West", "East"],
                    "fare_class": "Rapid Transit",
                    "long_name": "Green Line B",
                    "short_name": "B",
                    "sort_order": 10032,
                    "text_color": "FFFFFF",
                    "type": 0,
                },
                "relationships": {
                    "line": {"data": {"id": "line-Green", "type": "line"}},
                },
            },
        ]
    }


@pytest.fixture
def sample_stops_response() -> dict:
    """Sample MBTA API response for stops."""
    return {
        "data": [
            {
                "id": "place-portr",
                "type": "stop",
                "attributes": {
                    "name": "Porter",
                    "description": None,
                    "latitude": 42.3884,
                    "longitude": -71.1191,
                    "municipality": "Cambridge",
                    "wheelchair_boarding": 1,
                    "location_type": 1,
                    "platform_code": None,
                    "vehicle_type": None,
                },
                "relationships": {
                    "parent_station": {"data": None},
                    "zone": {"data": {"id": "RapidTransit", "type": "zone"}},
                },
            },
        ]
    }