"""API discovery script — explore MBTA API responses before building extractors."""

import json
from pathlib import Path

import httpx

from src.config import get_config


def discover_endpoint(endpoint: str, params: dict | None = None, limit: int = 2) -> dict:
    """Fetch a small sample from an endpoint and inspect the shape."""
    config = get_config()
    client = httpx.Client(
        base_url=config.mbta.base_url,
        headers=config.mbta.headers,
        timeout=config.mbta.timeout,
    )

    default_params = {"page[limit]": limit}
    if params:
        default_params.update(params)

    response = client.get(endpoint, params=default_params)
    response.raise_for_status()
    data = response.json()
    client.close()
    return data


def inspect_entity(endpoint: str, params: dict | None = None) -> None:
    """Print the structure of an API response for development."""
    data = discover_endpoint(endpoint, params)

    print(f"\n{'='*60}")
    print(f"ENDPOINT: {endpoint}")
    print(f"{'='*60}")

    items = data.get("data", [])
    print(f"Record count (sampled): {len(items)}")

    if items:
        first = items[0]
        print(f"\nTop-level keys: {list(first.keys())}")
        print(f"  id: {first.get('id')}")
        print(f"  type: {first.get('type')}")

        attrs = first.get("attributes", {})
        print(f"\nAttributes ({len(attrs)} fields):")
        for key, value in attrs.items():
            print(f"  {key}: {type(value).__name__} = {value}")

        rels = first.get("relationships", {})
        if rels:
            print(f"\nRelationships ({len(rels)}):")
            for rel_name, rel_data in rels.items():
                inner = rel_data.get("data")
                if isinstance(inner, dict):
                    print(f"  {rel_name}: {inner.get('id')} ({inner.get('type')})")
                elif isinstance(inner, list):
                    print(f"  {rel_name}: list[{len(inner)}]")
                else:
                    print(f"  {rel_name}: {inner}")

    print(f"\n--- Raw first record ---")
    print(json.dumps(items[0] if items else {}, indent=2, default=str))


def save_samples(output_dir: str = "./data/samples") -> None:
    """Save sample responses for all endpoints for offline development."""
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    endpoints = {
        "routes": "/routes",
        "stops": "/stops",
        "trips": "/trips",
        "schedules": "/schedules",
        "predictions": "/predictions",
        "vehicles": "/vehicles",
        "alerts": "/alerts",
    }

    # Some endpoints need filters to return data
    endpoint_params = {
        "predictions": {"filter[route]": "Red"},
        "schedules": {"filter[route]": "Red"},
        "trips": {"filter[route]": "Red"},
        "vehicles": {"filter[route]": "Red"},
    }

    for name, endpoint in endpoints.items():
        try:
            params = endpoint_params.get(name)
            data = discover_endpoint(endpoint, params=params, limit=5)
            path = Path(output_dir) / f"{name}_sample.json"
            path.write_text(json.dumps(data, indent=2, default=str))
            record_count = len(data.get("data", []))
            print(f"✓ {name}: {record_count} records → {path}")
        except Exception as e:
            print(f"✗ {name}: {e}")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "save":
        save_samples()
    else:
        endpoints = [
            "/routes",
            "/stops",
            "/trips",
            "/schedules",
            "/predictions",
            "/vehicles",
            "/alerts",
        ]

        # Endpoints that need route filter
        filtered = {
            "/predictions": {"filter[route]": "Red"},
            "/schedules": {"filter[route]": "Red"},
            "/trips": {"filter[route]": "Red"},
            "/vehicles": {"filter[route]": "Red"},
        }

        for ep in endpoints:
            try:
                inspect_entity(ep, params=filtered.get(ep))
            except Exception as e:
                print(f"\n✗ {ep}: {e}")