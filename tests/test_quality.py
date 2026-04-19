"""Tests for data quality validators."""

import polars as pl

from src.quality.validators import validate_dataframe


class TestRouteValidation:
    def test_valid_routes_pass(self):
        df = pl.DataFrame({
            "route_id": ["Red", "Blue", "Green-B"],
            "long_name": ["Red Line", "Blue Line", "Green Line B"],
            "route_type": [1, 1, 0],
            "route_type_desc": ["Heavy Rail", "Heavy Rail", "Light Rail"],
            "color": ["DA291C", "003DA5", "00843D"],
            "description": ["Rapid Transit"] * 3,
        })
        # Pad to meet minimum row count
        df = pl.concat([df] * 50)
        result = validate_dataframe("routes", df)
        assert result.pass_count > 0

    def test_null_route_id_fails(self):
        df = pl.DataFrame({
            "route_id": [None, "Blue"],
            "long_name": ["Red Line", "Blue Line"],
            "route_type": [1, 1],
            "route_type_desc": ["Heavy Rail", "Heavy Rail"],
            "color": ["DA291C", "003DA5"],
            "description": ["Rapid Transit"] * 2,
        })
        df = pl.concat([df] * 100)
        result = validate_dataframe("routes", df)
        not_null_check = [
            r for r in result.results if r.name == "not_null:route_id"
        ]
        assert len(not_null_check) == 1
        assert not not_null_check[0].passed

    def test_empty_dataframe_fails(self):
        df = pl.DataFrame(schema={
            "route_id": pl.Utf8,
            "long_name": pl.Utf8,
            "route_type": pl.Int32,
        })
        result = validate_dataframe("routes", df)
        assert not result.passed


class TestVehicleValidation:
    def test_out_of_range_latitude_fails(self):
        df = pl.DataFrame({
            "vehicle_id": ["V1"],
            "route_id": ["Red"],
            "latitude": [99.0],
            "longitude": [-71.0],
            "current_status": ["STOPPED_AT"],
            "extracted_at": ["2026-04-19T12:00:00"],
        })
        result = validate_dataframe("vehicles", df)
        range_check = [
            r for r in result.results if r.name == "valid_range:latitude"
        ]
        assert len(range_check) == 1
        assert not range_check[0].passed


class TestWeatherValidation:
    def test_valid_weather_passes(self):
        df = pl.DataFrame({
            "timestamp": [f"2026-04-19T{h:02d}:00" for h in range(24)],
            "temperature_2m": [50.0] * 24,
            "precipitation": [0.0] * 24,
            "wind_speed_10m": [10.0] * 24,
            "weather_code": [0] * 24,
        })
        result = validate_dataframe("weather", df)
        assert result.passed
