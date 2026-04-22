"""BigQuery loader — loads parquet from GCS into BigQuery tables."""

from uuid import uuid4

from src.config import AppConfig, get_config
from src.utils.logger import get_logger


def _load_google_clients():
    """Import Google clients only when BigQuery loading is actually used."""
    try:
        from google.api_core.exceptions import NotFound
        from google.cloud import bigquery, storage
    except ModuleNotFoundError as exc:
        raise ModuleNotFoundError(
            "BigQueryLoader requires google-cloud-bigquery and google-cloud-storage. "
            "Install the production requirements before using BigQuery loading."
        ) from exc

    return NotFound, bigquery, storage


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

    DEDUPE_KEYS = {
        "predictions": ["prediction_id", "extracted_at"],
        "vehicles": ["vehicle_id", "extracted_at"],
        "alerts": ["alert_id", "extracted_at"],
    }

    def __init__(self, config: AppConfig | None = None) -> None:
        self.config = config or get_config()
        self.logger = get_logger(self.__class__.__name__)
        self._not_found_error, self._bigquery, storage = _load_google_clients()
        self.client = self._bigquery.Client(project=self.config.gcp.project_id)
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

        job_config = self._bigquery.LoadJobConfig(
            source_format=self._bigquery.SourceFormat.PARQUET,
            write_disposition=entity_config["mode"],
        )

        self.logger.info(
            "loading",
            entity=entity,
            table=table_id,
            files=len(uris),
        )

        if entity_config["mode"] == "WRITE_APPEND" and entity in self.DEDUPE_KEYS:
            return self._merge_from_uris(entity, uris, table_id)

        load_job = self.client.load_table_from_uri(
            uris, table_id, job_config=job_config
        )
        load_job.result()  # Wait for completion

        table = self.client.get_table(table_id)
        self.logger.info("loaded", entity=entity, table=table_id, rows=table.num_rows)
        return table.num_rows

    @staticmethod
    def _quote_identifier(identifier: str) -> str:
        return f"`{identifier.replace('`', '``')}`"

    def _deduped_source_query(self, staging_table_id: str, keys: list[str]) -> str:
        key_list = ", ".join(self._quote_identifier(key) for key in keys)
        return f"""
            SELECT * EXCEPT(_dedupe_rank)
            FROM (
              SELECT
                *,
                ROW_NUMBER() OVER (
                  PARTITION BY {key_list}
                  ORDER BY {key_list}
                ) AS _dedupe_rank
              FROM `{staging_table_id}`
            )
            WHERE _dedupe_rank = 1
            """

    def _dedupe_existing_table(self, entity: str, table_id: str) -> int:
        """Remove duplicate raw fact rows already present in a BigQuery table."""
        keys = self.DEDUPE_KEYS.get(entity)
        if not keys:
            return self.client.get_table(table_id).num_rows

        try:
            table = self.client.get_table(table_id)
        except self._not_found_error:
            return 0

        columns = [field.name for field in table.schema]
        if not all(key in columns for key in keys):
            return table.num_rows

        deduped_table_id = (
            f"{self.config.gcp.project_id}.{self.dataset}."
            f"dedupe_{entity}_{uuid4().hex}"
        )
        source_query = self._deduped_source_query(table_id, keys)

        try:
            self.client.query(
                f"""
                CREATE TABLE `{deduped_table_id}` AS
                {source_query}
                """
            ).result()
            self.client.query(
                f"""
                CREATE OR REPLACE TABLE `{table_id}` AS
                SELECT * FROM `{deduped_table_id}`
                """
            ).result()
        finally:
            self.client.delete_table(deduped_table_id, not_found_ok=True)

        table = self.client.get_table(table_id)
        self.logger.info("deduped", entity=entity, table=table_id, rows=table.num_rows)
        return table.num_rows

    def dedupe_entity(self, entity: str) -> int:
        """Remove duplicate rows from an existing raw append table."""
        if entity not in self.ENTITIES:
            raise ValueError(f"Unknown entity: {entity}")

        entity_config = self.ENTITIES[entity]
        table_id = f"{self.config.gcp.project_id}.{self.dataset}.{entity_config['table']}"
        return self._dedupe_existing_table(entity, table_id)

    def _merge_from_uris(self, entity: str, uris: list[str], table_id: str) -> int:
        """Load fact files through a staging table, then insert only unseen rows."""
        staging_table_id = (
            f"{self.config.gcp.project_id}.{self.dataset}."
            f"load_staging_{entity}_{uuid4().hex}"
        )
        staging_config = self._bigquery.LoadJobConfig(
            source_format=self._bigquery.SourceFormat.PARQUET,
            write_disposition=self._bigquery.WriteDisposition.WRITE_TRUNCATE,
        )

        load_job = self.client.load_table_from_uri(
            uris, staging_table_id, job_config=staging_config
        )

        try:
            load_job.result()
            staging_table = self.client.get_table(staging_table_id)
            columns = [field.name for field in staging_table.schema]
            keys = self.DEDUPE_KEYS[entity]

            if not all(key in columns for key in keys):
                missing = [key for key in keys if key not in columns]
                raise ValueError(f"Missing dedupe key columns for {entity}: {missing}")

            source_query = self._deduped_source_query(staging_table_id, keys)

            try:
                self.client.get_table(table_id)
            except self._not_found_error:
                create_sql = f"""
                CREATE TABLE `{table_id}` AS
                {source_query}
                """
                self.client.query(create_sql).result()
            else:
                column_list = ", ".join(self._quote_identifier(col) for col in columns)
                value_list = ", ".join(f"S.{self._quote_identifier(col)}" for col in columns)
                join_predicates = " AND ".join(
                    f"T.{self._quote_identifier(key)} = S.{self._quote_identifier(key)}"
                    for key in keys
                )
                merge_sql = f"""
                MERGE `{table_id}` AS T
                USING ({source_query}) AS S
                ON {join_predicates}
                WHEN NOT MATCHED THEN
                  INSERT ({column_list})
                  VALUES ({value_list})
                """
                self.client.query(merge_sql).result()

            row_count = self._dedupe_existing_table(entity, table_id)
            self.logger.info("merged", entity=entity, table=table_id, rows=row_count)
            return row_count
        finally:
            self.client.delete_table(staging_table_id, not_found_ok=True)

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
