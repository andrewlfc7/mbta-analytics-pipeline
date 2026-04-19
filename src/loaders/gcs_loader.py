"""GCS loader — uploads raw parquet files to Google Cloud Storage."""

from pathlib import Path

from google.cloud import storage

from src.config import AppConfig, get_config
from src.utils.logger import get_logger


class GCSLoader:
    """Upload parquet files to GCS with partitioned paths."""

    def __init__(self, config: AppConfig | None = None) -> None:
        self.config = config or get_config()
        self.logger = get_logger(self.__class__.__name__)
        self.client = storage.Client(project=self.config.gcp.project_id)
        self.bucket = self.client.bucket(self.config.gcp.bucket)

    def upload_parquet(self, local_path: str, gcs_path: str | None = None) -> str:
        """Upload a local parquet file to GCS.

        Args:
            local_path: Path to local parquet file
            gcs_path: Optional GCS path override. If None, mirrors local structure.

        Returns:
            GCS URI (gs://bucket/path)
        """
        local_path = Path(local_path)
        if not local_path.exists():
            raise FileNotFoundError(f"File not found: {local_path}")

        if gcs_path is None:
            # Mirror local raw path structure: data/raw/routes/dt=.../routes.parquet
            # → routes/dt=.../routes.parquet
            parts = local_path.parts
            try:
                raw_idx = parts.index("raw")
                gcs_path = "/".join(parts[raw_idx + 1:])
            except ValueError:
                gcs_path = local_path.name

        blob = self.bucket.blob(gcs_path)
        blob.upload_from_filename(str(local_path))

        uri = f"gs://{self.config.gcp.bucket}/{gcs_path}"
        self.logger.info("uploaded", local=str(local_path), gcs=uri)
        return uri

    def upload_entity(self, entity: str, local_raw_path: str | None = None) -> list[str]:
        """Upload all parquet files for an entity to GCS."""
        raw_path = Path(local_raw_path or str(self.config.local.raw_path))
        entity_path = raw_path / entity

        if not entity_path.exists():
            self.logger.warning("no_local_files", entity=entity)
            return []

        uris = []
        for parquet_file in entity_path.glob("**/*.parquet"):
            uri = self.upload_parquet(str(parquet_file))
            uris.append(uri)

        self.logger.info("entity_uploaded", entity=entity, files=len(uris))
        return uris

    def upload_all(self, local_raw_path: str | None = None) -> dict[str, int]:
        """Upload all entities to GCS."""
        entities = ["routes", "stops", "trips", "schedules",
                     "predictions", "vehicles", "alerts", "weather"]
        results = {}
        for entity in entities:
            uris = self.upload_entity(entity, local_raw_path)
            results[entity] = len(uris)
        return results


def main():
    """Upload all local raw data to GCS."""
    loader = GCSLoader()
    print("Uploading all entities to GCS...\n")
    results = loader.upload_all()

    print("\n" + "=" * 50)
    print("GCS UPLOAD RESULTS")
    print("=" * 50)
    for entity, count in results.items():
        status = "✓" if count > 0 else "⚠"
        print(f"  {status} {entity:<15} {count} files")


if __name__ == "__main__":
    main()