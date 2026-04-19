"""BigQuery loader — loads parquet from GCS into BigQuery tables."""

from google.cloud import bigquery, storage

from src.config import AppConfig, get_config
from src.utils.logger import get_logger


class BigQueryLoader:
    """Load data from GCS parquet files into BigQuery tables."""

    ENTITIES = {
        "routes": {"table": "raw_routes", "mode": "WRITE_TRUNCATE"},
        "stops": {"table": "raw_stops", "mode": "WRITE_TRUNCATE"},
        "trips": {"table": "raw_trips", "mode": "WRITE_TRUNCATE"},
        "schedules": {"table": "raw_schedules", "mode": "WRITE_TRUNCATE"},
        "predictions": {"table": "raw_predictions", "mode": "WRITE_APPEND"},
        "vehicles": {"table": "raw_vehicles", "mode": "WRITE_APPEND"},
        "alerts": {"table": "raw_alerts", "mode": "WRITE_APPEND"},
        "weather": {"table": "raw_weather", "mode": "WRITE_TRUNCATE"},
    }

    def __init__(self, config: AppConfig | None = None) -> None:
        self.config = config or get_config()
        self.logger = get_logger(self.__class__.__name__)
        self.client = bigquery.Client(project=self.config.gcp.project_id)
        self.storage_client = storage.Client(project=self.config.gcp.project_id)
        self.dataset = self.config.gcp.dataset

    def _list_parquet_uris(self, entity: str) -> list[str]:
        """List all parquet files in GCS for a given entity."""
        bucket = self.storage_client.bucket(self.config.gcp.bucket)
        blobs = bucket.list_blobs(prefix=f"{entity}/")
        uris = [
            f"gs://{self.config.gcp.bucket}/{blob.name}"
            for blob in blobs
            if blob.name.endswith(".parquet")
        ]
        return uris

    def load_from_gcs(self, entity: str, gcs_uri: str | None = None) -> int:
        """Load parquet from GCS into BigQuery.

        Args:
            entity: Entity name
            gcs_uri: GCS URI pattern. If None, discovers files from bucket.

        Returns:
            Number of rows loaded
        """
        if entity not in self.ENTITIES:
            raise ValueError(f"Unknown entity: {entity}")

        entity_config = self.ENTITIES[entity]
        table_id = f"{self.config.gcp.project_id}.{self.dataset}.{entity_config['table']}"

        if gcs_uri is None:
            uris = self._list_parquet_uris(entity)
            if not uris:
                self.logger.warning("no_files_in_gcs", entity=entity)
                return 0
        else:
            uris = [gcs_uri]

        job_config = bigquery.LoadJobConfig(
            source_format=bigquery.SourceFormat.PARQUET,
            write_disposition=entity_config["mode"],
        )

        self.logger.info(
            "loading",
            entity=entity,
            table=table_id,
            files=len(uris),
        )

        load_job = self.client.load_table_from_uri(
            uris, table_id, job_config=job_config
        )
        load_job.result()  # Wait for completion

        table = self.client.get_table(table_id)
        self.logger.info("loaded", entity=entity, table=table_id, rows=table.num_rows)
        return table.num_rows

    def load_all(self) -> dict[str, int]:
        """Load all entities from GCS into BigQuery."""
        results = {}
        for entity in self.ENTITIES:
            try:
                rows = self.load_from_gcs(entity)
                results[entity] = rows
            except Exception as e:
                self.logger.error("load_failed", entity=entity, error=str(e))
                results[entity] = -1
        return results

    def table_stats(self) -> dict[str, int]:
        """Get row counts for all raw tables."""
        stats = {}
        for entity, config in self.ENTITIES.items():
            table_id = f"{self.config.gcp.project_id}.{self.dataset}.{config['table']}"
            try:
                table = self.client.get_table(table_id)
                stats[config["table"]] = table.num_rows
            except Exception:
                stats[config["table"]] = 0
        return stats


def main():
    """Load all GCS data into BigQuery."""
    loader = BigQueryLoader()
    print("Loading all entities from GCS into BigQuery...\n")
    results = loader.load_all()

    print("\n" + "=" * 50)
    print("BIGQUERY LOAD RESULTS")
    print("=" * 50)
    for entity, count in results.items():
        status = "✓" if count > 0 else "⚠" if count == 0 else "✗"
        print(f"  {status} {entity:<15} {count:>10} rows")


if __name__ == "__main__":
    main()
