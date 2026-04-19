"""Tests for entity extractors — schema validation, typing, and edge cases."""

import polars as pl
import pytest

from src.ingestion.alerts import AlertsExtractor
from src.ingestion.predictions import PredictionsExtractor
from src.ingestion.routes import RoutesExtractor
from src.ingestion.schedules import SchedulesExtractor
from src.ingestion.stops import StopsExtractor
from src.ingestion.trips import TripsExtractor
from src.ingestion.vehicles import VehiclesExtractor
from src.ingestion.weather import WeatherExtractor

# ---------------------------------------------------------------------------
# Fixtures — sample API records (post-parsing, pre-dataframe)
# ---------------------------------------------------------------------------



@pytest.fixture
def route_records() -> list[dict]:
    return [
        {
            "id": "Red",
            "type": 1,  # attributes.type overwrites JSON:API type in _parse_response
            "long_name": "Red Line",
            "short_name": "",
            "description": "Rapid Transit",
            "fare_class": "Rapid Transit",
            "color": "DA291C",
            "text_color": "FFFFFF",
            "sort_order": 10010,
            "direction_names": ["South", "North"],
            "direction_destinations": ["Ashmont/Braintree", "Alewife"],
            "listed_route": True,
            "line_id": "line-Red",
            "agency_id": "1",
        },
        {
            "id": "Green-B",
            "type": 0,
            "long_name": "Green Line B",
            "short_name": "B",
            "description": "Rapid Transit",
            "fare_class": "Rapid Transit",
            "color": "00843D",
            "text_color": "FFFFFF",
            "sort_order": 10032,
            "direction_names": ["West", "East"],
            "direction_destinations": ["Boston College", "Government Center"],
            "listed_route": True,
            "line_id": "line-Green",
            "agency_id": "1",
        },
    ]


@pytest.fixture
def stop_records() -> list[dict]:
    return [
        {
            "id": "place-portr",
            "type": "stop",
            "name": "Porter",
            "description": None,
            "latitude": 42.3884,
            "longitude": -71.1191,
            "address": None,
            "municipality": "Cambridge",
            "on_street": None,
            "at_street": None,
            "location_type": 1,
            "vehicle_type": None,
            "platform_code": None,
            "platform_name": None,
            "wheelchair_boarding": 1,
            "parent_station_id": None,
            "zone_id": "RapidTransit",
        },
        {
            "id": "5682",
            "type": "stop",
            "name": "Everett Ave @ Arlington St",
            "description": None,
            "latitude": 42.393652,
            "longitude": -71.039037,
            "address": None,
            "municipality": "Chelsea",
            "on_street": "Everett Avenue",
            "at_street": "Arlington Street",
            "location_type": 0,
            "vehicle_type": 3,
            "platform_code": None,
            "platform_name": None,
            "wheelchair_boarding": 1,
            "parent_station_id": None,
            "zone_id": "LocalBus",
        },
    ]


@pytest.fixture
def trip_records() -> list[dict]:
    return [
        {
            "id": "75462778",
            "type": "trip",
            "headsign": "Alewife",
            "name": "",
            "direction_id": 1,
            "block_id": "S931_-1",
            "bikes_allowed": 0,
            "wheelchair_accessible": 1,
            "revenue": "REVENUE",
            "route_id": "Red",
            "route_pattern_id": "Red-1-1",
            "service_id": "SpringSaturday",
            "shape_id": "931_0010",
        },
    ]


@pytest.fixture
def schedule_records() -> list[dict]:
    return [
        {
            "id": "schedule-75533233-70094-50",
            "type": "schedule",
            "arrival_time": None,
            "departure_time": "2026-04-19T06:00:00-04:00",
            "direction_id": 1,
            "stop_sequence": 50,
            "stop_headsign": None,
            "pickup_type": 0,
            "drop_off_type": 1,
            "timepoint": False,
            "route_id": "Red",
            "stop_id": "70094",
            "trip_id": "75533233",
        },
    ]


@pytest.fixture
def prediction_records() -> list[dict]:
    return [
        {
            "id": "prediction-75533511-70061-1-Red",
            "type": "prediction",
            "arrival_time": None,
            "arrival_uncertainty": None,
            "departure_time": "2026-04-19T12:02:00-04:00",
            "departure_uncertainty": 360,
            "direction_id": 0,
            "stop_sequence": 1,
            "schedule_relationship": None,
            "status": None,
            "revenue": "REVENUE",
            "last_trip": False,
            "update_type": "REVERSE_TRIP",
            "route_id": "Red",
            "stop_id": "70061",
            "trip_id": "75533511",
            "vehicle_id": "R-54891FFE",
        },
    ]


@pytest.fixture
def vehicle_records() -> list[dict]:
    return [
        {
            "id": "R-54892745",
            "type": "vehicle",
            "label": "1930",
            "latitude": 42.35526,
            "longitude": -71.06016,
            "bearing": 310,
            "speed": None,
            "current_status": "STOPPED_AT",
            "current_stop_sequence": 140,
            "direction_id": 1,
            "occupancy_status": None,
            "revenue": "REVENUE",
            "updated_at": "2026-04-19T11:01:24-04:00",
            "route_id": "Red",
            "stop_id": "70078",
            "trip_id": "ADDED-1583710059",
            "carriages": [
                {
                    "label": "1930",
                    "occupancy_status": "FEW_SEATS_AVAILABLE",
                    "occupancy_percentage": 9,
                },
                {
                    "label": "1931",
                    "occupancy_status": "FEW_SEATS_AVAILABLE",
                    "occupancy_percentage": 7,
                },
                {
                    "label": "1953",
                    "occupancy_status": "FEW_SEATS_AVAILABLE",
                    "occupancy_percentage": 9,
                },
            ],
        },
        {
            "id": "R-EMPTY",
            "type": "vehicle",
            "label": "0000",
            "latitude": 42.0,
            "longitude": -71.0,
            "bearing": 0,
            "speed": None,
            "current_status": "IN_TRANSIT_TO",
            "current_stop_sequence": 1,
            "direction_id": 0,
            "occupancy_status": None,
            "revenue": "REVENUE",
            "updated_at": "2026-04-19T11:00:00-04:00",
            "route_id": "Orange",
            "stop_id": "70001",
            "trip_id": "TRIP-1",
            "carriages": [],
        },
    ]


@pytest.fixture
def alert_records() -> list[dict]:
    """Pre-parsed alert records (after custom _parse_response)."""
    return [
        {
            "id": "1001814",
            "type": "alert",
            "cause": "UNKNOWN_CAUSE",
            "effect": "STATION_ISSUE",
            "severity": 1,
            "lifecycle": "ONGOING",
            "header": "Platform renovations at Jackson Square",
            "description": "Please see station personnel.",
            "short_header": "",
            "service_effect": "Station issue at Jackson Square",
            "duration_certainty": "UNKNOWN",
            "active_period": [
                {"start": "2025-09-27T03:00:00-04:00", "end": None},
            ],
            "created_at": "2026-03-20T23:20:55-04:00",
            "updated_at": "2026-03-26T21:31:45-04:00",
            "closed_timestamp": None,
            "url": "http://www.mbta.com/JacksonSquare",
            "informed_entity": [
                {
                    "stop": "70006",
                    "route_type": 1,
                    "route": "Orange",
                    "activities": ["BOARD"],
                },
                {
                    "stop": "70007",
                    "route_type": 1,
                    "route": "Orange",
                    "activities": ["BOARD"],
                },
                {
                    "stop": "place-jaksn",
                    "route_type": 1,
                    "route": "Orange",
                    "activities": ["BOARD"],
                },
            ],
            "banner": None,
            "image": None,
            "image_alternative_text": None,
            "last_push_notification_timestamp": None,
            "reminder_times": None,
            "timeframe": None,
        },
    ]


@pytest.fixture
def weather_response() -> dict:
    return {
        "hourly": {
            "time": ["2026-04-19T00:00", "2026-04-19T01:00", "2026-04-19T02:00"],
            "temperature_2m": [48.5, 47.2, 46.1],
            "relative_humidity_2m": [72.0, 75.0, 78.0],
            "precipitation": [0.0, 0.0, 0.1],
            "rain": [0.0, 0.0, 0.1],
            "snowfall": [0.0, 0.0, 0.0],
            "wind_speed_10m": [8.5, 7.2, 6.8],
            "wind_gusts_10m": [15.0, 12.5, 11.0],
            "visibility": [24140.0, 24140.0, 20000.0],
            "weather_code": [0, 0, 51],
        }
    }


# ---------------------------------------------------------------------------
# Routes Tests
# ---------------------------------------------------------------------------


class TestRoutesExtractor:
    def test_to_dataframe_schema(self, route_records):
        extractor = RoutesExtractor()
        df = extractor.to_dataframe(route_records)

        assert df.shape[0] == 2
        assert "route_id" in df.columns
        assert "route_type_desc" in df.columns
        assert df.schema["route_id"] == pl.Utf8
        assert df.schema["route_type"] == pl.Int32
        assert df.schema["sort_order"] == pl.Int32
        assert df.schema["listed_route"] == pl.Boolean

    def test_route_type_mapping(self, route_records):
        extractor = RoutesExtractor()
        df = extractor.to_dataframe(route_records)

        red_line = df.filter(pl.col("route_id") == "Red")
        assert red_line["route_type_desc"][0] == "Heavy Rail"

    def test_empty_short_name_becomes_null(self, route_records):
        extractor = RoutesExtractor()
        df = extractor.to_dataframe(route_records)

        red_line = df.filter(pl.col("route_id") == "Red")
        assert red_line["short_name"][0] is None

    def test_empty_records(self):
        extractor = RoutesExtractor()
        df = extractor.to_dataframe([])
        assert df.shape[0] == 0
        assert "route_id" in df.columns


# ---------------------------------------------------------------------------
# Stops Tests
# ---------------------------------------------------------------------------


class TestStopsExtractor:
    def test_to_dataframe_schema(self, stop_records):
        extractor = StopsExtractor()
        df = extractor.to_dataframe(stop_records)

        assert df.shape[0] == 2
        assert "stop_id" in df.columns
        assert df.schema["latitude"] == pl.Float64
        assert df.schema["longitude"] == pl.Float64
        assert df.schema["location_type"] == pl.Int32

    def test_location_type_mapping(self, stop_records):
        extractor = StopsExtractor()
        df = extractor.to_dataframe(stop_records)

        porter = df.filter(pl.col("stop_id") == "place-portr")
        assert porter["location_type_desc"][0] == "Station"

        bus_stop = df.filter(pl.col("stop_id") == "5682")
        assert bus_stop["location_type_desc"][0] == "Stop/Platform"

    def test_null_vehicle_type_handling(self, stop_records):
        extractor = StopsExtractor()
        df = extractor.to_dataframe(stop_records)

        porter = df.filter(pl.col("stop_id") == "place-portr")
        assert porter["vehicle_type"][0] is None
        assert porter["vehicle_type_desc"][0] is None

    def test_empty_records(self):
        extractor = StopsExtractor()
        df = extractor.to_dataframe([])
        assert df.shape[0] == 0


# ---------------------------------------------------------------------------
# Trips Tests
# ---------------------------------------------------------------------------


class TestTripsExtractor:
    def test_to_dataframe_schema(self, trip_records):
        extractor = TripsExtractor()
        df = extractor.to_dataframe(trip_records)

        assert df.shape[0] == 1
        assert "trip_id" in df.columns
        assert "route_id" in df.columns
        assert df.schema["direction_id"] == pl.Int32

    def test_relationship_ids_extracted(self, trip_records):
        extractor = TripsExtractor()
        df = extractor.to_dataframe(trip_records)

        assert df["route_id"][0] == "Red"
        assert df["service_id"][0] == "SpringSaturday"
        assert df["shape_id"][0] == "931_0010"

    def test_empty_records(self):
        extractor = TripsExtractor()
        df = extractor.to_dataframe([])
        assert df.shape[0] == 0


# ---------------------------------------------------------------------------
# Schedules Tests
# ---------------------------------------------------------------------------


class TestSchedulesExtractor:
    def test_to_dataframe_schema(self, schedule_records):
        extractor = SchedulesExtractor()
        df = extractor.to_dataframe(schedule_records)

        assert df.shape[0] == 1
        assert "schedule_id" in df.columns
        assert df.schema["stop_sequence"] == pl.Int32
        assert df.schema["timepoint"] == pl.Boolean

    def test_null_arrival_time(self, schedule_records):
        """First stop often has null arrival_time."""
        extractor = SchedulesExtractor()
        df = extractor.to_dataframe(schedule_records)

        assert df["arrival_time"][0] is None
        assert df["departure_time"][0] is not None

    def test_empty_records(self):
        extractor = SchedulesExtractor()
        df = extractor.to_dataframe([])
        assert df.shape[0] == 0


# ---------------------------------------------------------------------------
# Predictions Tests
# ---------------------------------------------------------------------------


class TestPredictionsExtractor:
    def test_to_dataframe_schema(self, prediction_records):
        extractor = PredictionsExtractor()
        df = extractor.to_dataframe(prediction_records)

        assert df.shape[0] == 1
        assert "prediction_id" in df.columns
        assert "extracted_at" in df.columns
        assert df.schema["departure_uncertainty"] == pl.Int32

    def test_extracted_at_populated(self, prediction_records):
        extractor = PredictionsExtractor()
        df = extractor.to_dataframe(prediction_records)

        assert df["extracted_at"][0] is not None

    def test_null_fields_preserved(self, prediction_records):
        extractor = PredictionsExtractor()
        df = extractor.to_dataframe(prediction_records)

        assert df["arrival_time"][0] is None
        assert df["status"][0] is None

    def test_empty_records(self):
        extractor = PredictionsExtractor()
        df = extractor.to_dataframe([])
        assert df.shape[0] == 0


# ---------------------------------------------------------------------------
# Vehicles Tests
# ---------------------------------------------------------------------------


class TestVehiclesExtractor:
    def test_to_dataframe_schema(self, vehicle_records):
        extractor = VehiclesExtractor()
        df = extractor.to_dataframe(vehicle_records)

        assert df.shape[0] == 2
        assert "vehicle_id" in df.columns
        assert "avg_occupancy_pct" in df.columns
        assert "carriage_count" in df.columns
        assert df.schema["latitude"] == pl.Float64

    def test_carriage_occupancy_computed(self, vehicle_records):
        extractor = VehiclesExtractor()
        df = extractor.to_dataframe(vehicle_records)

        with_carriages = df.filter(pl.col("vehicle_id") == "R-54892745")
        assert with_carriages["carriage_count"][0] == 3
        # avg of 9, 7, 9 = 8.33
        assert abs(with_carriages["avg_occupancy_pct"][0] - 8.33) < 0.01

    def test_empty_carriages(self, vehicle_records):
        extractor = VehiclesExtractor()
        df = extractor.to_dataframe(vehicle_records)

        empty = df.filter(pl.col("vehicle_id") == "R-EMPTY")
        assert empty["carriage_count"][0] == 0
        assert empty["avg_occupancy_pct"][0] is None

    def test_empty_records(self):
        extractor = VehiclesExtractor()
        df = extractor.to_dataframe([])
        assert df.shape[0] == 0


# ---------------------------------------------------------------------------
# Alerts Tests
# ---------------------------------------------------------------------------


class TestAlertsExtractor:
    def test_to_dataframe_schema(self, alert_records):
        extractor = AlertsExtractor()
        df = extractor.to_dataframe(alert_records)

        assert df.shape[0] == 1
        assert "alert_id" in df.columns
        assert "affected_routes" in df.columns
        assert "affected_stops" in df.columns
        assert df.schema["severity"] == pl.Int32

    def test_active_period_flattened(self, alert_records):
        extractor = AlertsExtractor()
        df = extractor.to_dataframe(alert_records)

        assert df["active_start"][0] == "2025-09-27T03:00:00-04:00"
        assert df["active_end"][0] is None



    def test_informed_entity_extracted(self, alert_records):
        extractor = AlertsExtractor()
        df = extractor.to_dataframe(alert_records)

        assert df["informed_entity_count"][0] == 3
        routes = df["affected_routes"][0]
        assert "Orange" in routes
        stops = df["affected_stops"][0]
        assert "place-jaksn" in stops
        assert "70006" in stops
        assert "70007" in stops

    def test_empty_records(self):
        extractor = AlertsExtractor()
        df = extractor.to_dataframe([])
        assert df.shape[0] == 0


# ---------------------------------------------------------------------------
# Weather Tests
# ---------------------------------------------------------------------------


class TestWeatherExtractor:
    def test_to_dataframe_schema(self, weather_response):
        extractor = WeatherExtractor()
        df = extractor.to_dataframe(weather_response)

        assert df.shape[0] == 3
        assert "timestamp" in df.columns
        assert "temperature_2m" in df.columns
        assert df.schema["temperature_2m"] == pl.Float64
        assert df.schema["weather_code"] == pl.Int32

    def test_values_correct(self, weather_response):
        extractor = WeatherExtractor()
        df = extractor.to_dataframe(weather_response)

        assert df["temperature_2m"][0] == 48.5
        assert df["precipitation"][2] == 0.1
        assert df["weather_code"][2] == 51

    def test_empty_response(self):
        extractor = WeatherExtractor()
        df = extractor.to_dataframe({"hourly": {"time": []}})
        assert df.shape[0] == 0

    def test_missing_hourly(self):
        extractor = WeatherExtractor()
        df = extractor.to_dataframe({})
        assert df.shape[0] == 0
