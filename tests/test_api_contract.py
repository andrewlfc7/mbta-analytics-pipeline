"""API contract tests — hit the real API to validate response structure.

These tests verify the MBTA API hasn't changed its response format.
Run these periodically or when things break: pytest tests/test_api_contract.py -m contract
"""

import pytest
import httpx

from src.config import get_config

pytestmark = pytest.mark.contract


@pytest.fixture(scope="module")
def api_client():
    """Shared API client for contract tests."""
    config = get_config()
    client = httpx.Client(
        base_url=config.mbta.base_url,
        headers=config.mbta.headers,
        timeout=config.mbta.timeout,
    )
    yield client
    client.close()


class TestRoutesContract:
    """Verify /routes endpoint contract."""

    def test_routes_returns_data(self, api_client):
        response = api_client.get("/routes", params={"page[limit]": 2})
        response.raise_for_status()
        data = response.json()

        assert "data" in data
        assert len(data["data"]) > 0

    def test_routes_has_expected_attributes(self, api_client):
        response = api_client.get("/routes", params={"page[limit]": 1})
        data = response.json()
        attrs = data["data"][0]["attributes"]

        expected_fields = {
            "long_name",
            "short_name",
            "type",
            "color",
            "description",
            "direction_names",
            "direction_destinations",
            "sort_order",
        }
        actual_fields = set(attrs.keys())
        missing = expected_fields - actual_fields
        assert not missing, f"Missing fields in /routes response: {missing}"

    def test_routes_has_id_and_type(self, api_client):
        response = api_client.get("/routes", params={"page[limit]": 1})
        data = response.json()
        item = data["data"][0]

        assert "id" in item
        assert "type" in item
        assert item["type"] == "route"


class TestStopsContract:
    """Verify /stops endpoint contract."""

    def test_stops_returns_data(self, api_client):
        response = api_client.get("/stops", params={"page[limit]": 2})
        response.raise_for_status()
        data = response.json()

        assert "data" in data
        assert len(data["data"]) > 0

    def test_stops_has_expected_attributes(self, api_client):
        response = api_client.get("/stops", params={"page[limit]": 1})
        data = response.json()
        attrs = data["data"][0]["attributes"]

        expected_fields = {
            "name",
            "latitude",
            "longitude",
            "municipality",
            "wheelchair_boarding",
            "location_type",
        }
        actual_fields = set(attrs.keys())
        missing = expected_fields - actual_fields
        assert not missing, f"Missing fields in /stops response: {missing}"


class TestPredictionsContract:
    """Verify /predictions endpoint contract."""

    def test_predictions_returns_data(self, api_client):
        response = api_client.get(
            "/predictions",
            params={"filter[route]": "Red", "page[limit]": 2},
        )
        response.raise_for_status()
        data = response.json()

        assert "data" in data
        # Predictions might be empty late at night — just check structure
        assert isinstance(data["data"], list)

    def test_predictions_has_expected_attributes(self, api_client):
        response = api_client.get(
            "/predictions",
            params={"filter[route]": "Red", "page[limit]": 1},
        )
        data = response.json()

        if data["data"]:
            attrs = data["data"][0]["attributes"]
            expected_fields = {
                "arrival_time",
                "departure_time",
                "direction_id",
                "status",
                "schedule_relationship",
            }
            actual_fields = set(attrs.keys())
            missing = expected_fields - actual_fields
            assert not missing, f"Missing fields in /predictions response: {missing}"


class TestVehiclesContract:
    """Verify /vehicles endpoint contract."""

    def test_vehicles_returns_data(self, api_client):
        response = api_client.get(
            "/vehicles",
            params={"filter[route]": "Red", "page[limit]": 2},
        )
        response.raise_for_status()
        data = response.json()

        assert "data" in data
        assert isinstance(data["data"], list)

    def test_vehicles_has_expected_attributes(self, api_client):
        response = api_client.get(
            "/vehicles",
            params={"filter[route]": "Red", "page[limit]": 1},
        )
        data = response.json()

        if data["data"]:
            attrs = data["data"][0]["attributes"]
            expected_fields = {
                "latitude",
                "longitude",
                "bearing",
                "speed",
                "current_status",
                "current_stop_sequence",
            }
            actual_fields = set(attrs.keys())
            missing = expected_fields - actual_fields
            assert not missing, f"Missing fields in /vehicles response: {missing}"


class TestAlertsContract:
    """Verify /alerts endpoint contract."""

    def test_alerts_returns_data(self, api_client):
        response = api_client.get("/alerts", params={"page[limit]": 2})
        response.raise_for_status()
        data = response.json()

        assert "data" in data
        assert isinstance(data["data"], list)