"""Helper to fetch bus route IDs for batched ingestion."""

from google.cloud import bigquery
import logging

logger = logging.getLogger(__name__)


def get_bus_route_ids(project_id: str) -> list[str]:
    """Fetch all bus route IDs from BigQuery.

    route_type 3 = Bus in GTFS spec.
    """
    client = bigquery.Client(project=project_id)
    query = f"""
        SELECT route_id
        FROM `{project_id}.raw_mbta.raw_routes`
        WHERE route_type = 3
        ORDER BY route_id
    """
    results = client.query(query).result()
    route_ids = [row["route_id"] for row in results]
    logger.info(f"Found {len(route_ids)} bus routes in BigQuery")
    return route_ids