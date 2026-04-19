"""DuckDB loader — loads raw parquet files into DuckDB tables for local development."""

from pathlib import Path

import duckdb

from src.config import AppConfig, get_config
from src.utils.logger import get_logger


class DuckDBLoader:
    """Load raw parquet files into DuckDB tables.

    Supports both full-refresh (dimensions) and append (facts).
    """

    # Map entity names to their table names and load strategy
    ENTITIES = {
        "routes": {"table": "raw_routes", "mode": "replace"},
        "stops": {"table": "raw_stops", "mode": "replace"},
        "trips": {"table": "raw_trips", "mode": "replace"},
        "schedules": {"table": "raw_schedules", "mode": "replace"},
        "predictions": {"table": "raw_predictions", "mode": "append"},
        "vehicles": {"table": "raw_vehicles", "mode": "append"},
        "alerts": {"table": "raw_alerts", "mode": "append"},
        "weather": {"table": "raw_weather", "mode": "replace"},
    }

    def __init__(self, config: AppConfig | None = None) -> None:
        self.config = config or get_config()
        self.logger = get_logger(self.__class__.__name__)
        self.db_path = str(self.config.local.db_path)

        # Ensure directory exists
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)

    def get_connection(self) -> duckdb.DuckDBPyConnection:
        """Get a DuckDB connection."""
        return duckdb.connect(self.db_path)

    def _create_schema(self, conn: duckdb.DuckDBPyConnection) -> None:
        """Create raw_mbta schema if it doesn't exist."""
        conn.execute("CREATE SCHEMA IF NOT EXISTS raw_mbta")

    def load_parquet(
        self,
        entity: str,
        parquet_path: str | None = None,
        glob_pattern: str | None = None,
    ) -> int:
        """Load a parquet file or glob pattern into the corresponding raw table.

        Args:
            entity: Entity name (routes, stops, etc.)
            parquet_path: Path to a specific parquet file
            glob_pattern: Glob pattern to load multiple files (e.g., predictions/**/predictions.parquet)

        Returns:
            Number of rows loaded
        """
        if entity not in self.ENTITIES:
            raise ValueError(f"Unknown entity: {entity}. Expected one of {list(self.ENTITIES.keys())}")

        entity_config = self.ENTITIES[entity]
        table_name = f"raw_mbta.{entity_config['table']}"
        mode = entity_config["mode"]

        # Determine source
        if parquet_path:
            source = f"'{parquet_path}'"
        elif glob_pattern:
            source = f"'{glob_pattern}'"
        else:
            # Default: glob all parquet files for this entity
            raw_path = self.config.local.raw_path
            source = f"'{raw_path}/{entity}/**/*.parquet'"

        conn = self.get_connection()
        try:
            self._create_schema(conn)

            if mode == "replace":
                conn.execute(f"DROP TABLE IF EXISTS {table_name}")
                conn.execute(
                    f"CREATE TABLE {table_name} AS SELECT * FROM read_parquet({source}, union_by_name=true)"
                )
            elif mode == "append":
                # Create table if not exists, then insert
                table_exists = conn.execute(
                    f"""
                    SELECT count(*) FROM information_schema.tables
                    WHERE table_schema = 'raw_mbta' AND table_name = '{entity_config["table"]}'
                    """
                ).fetchone()[0] > 0

                if not table_exists:
                    conn.execute(
                        f"CREATE TABLE {table_name} AS SELECT * FROM read_parquet({source}, union_by_name=true)"
                    )
                else:
                    conn.execute(
                        f"INSERT INTO {table_name} SELECT * FROM read_parquet({source}, union_by_name=true)"
                    )

            row_count = conn.execute(f"SELECT count(*) FROM {table_name}").fetchone()[0]
            self.logger.info(
                "loaded",
                entity=entity,
                table=table_name,
                mode=mode,
                rows=row_count,
            )
            return row_count

        finally:
            conn.close()

    def load_all(self) -> dict[str, int]:
        """Load all entities from raw parquet files into DuckDB."""
        results = {}
        for entity in self.ENTITIES:
            try:
                raw_path = self.config.local.raw_path
                glob = f"{raw_path}/{entity}/**/*.parquet"

                # Check if any files exist
                files = list(Path(raw_path).glob(f"{entity}/**/*.parquet"))
                if not files:
                    self.logger.warning("no_files", entity=entity)
                    results[entity] = 0
                    continue

                row_count = self.load_parquet(entity, glob_pattern=glob)
                results[entity] = row_count
            except Exception as e:
                self.logger.error("load_failed", entity=entity, error=str(e))
                results[entity] = -1

        return results

    def query(self, sql: str) -> list:
        """Execute a query and return results."""
        conn = self.get_connection()
        try:
            return conn.execute(sql).fetchall()
        finally:
            conn.close()

    def table_stats(self) -> dict[str, int]:
        """Get row counts for all raw tables."""
        conn = self.get_connection()
        try:
            self._create_schema(conn)
            tables = conn.execute(
                """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'raw_mbta'
                ORDER BY table_name
                """
            ).fetchall()

            stats = {}
            for (table_name,) in tables:
                count = conn.execute(
                    f"SELECT count(*) FROM raw_mbta.{table_name}"
                ).fetchone()[0]
                stats[table_name] = count

            return stats
        finally:
            conn.close()

    def preview(self, entity: str, limit: int = 5) -> None:
        """Print a preview of a raw table."""
        table_name = f"raw_mbta.{self.ENTITIES[entity]['table']}"
        conn = self.get_connection()
        try:
            result = conn.execute(f"SELECT * FROM {table_name} LIMIT {limit}")
            print(result.fetch_df().to_string())
        finally:
            conn.close()


def main():
    """Load all raw parquet files into DuckDB and print stats."""
    loader = DuckDBLoader()
    print("Loading all entities into DuckDB...\n")

    results = loader.load_all()

    print("\n" + "=" * 50)
    print("LOAD RESULTS")
    print("=" * 50)
    for entity, count in results.items():
        status = "✓" if count > 0 else "⚠" if count == 0 else "✗"
        print(f"  {status} {entity:<15} {count:>10} rows")

    print("\n" + "=" * 50)
    print("TABLE STATS")
    print("=" * 50)
    stats = loader.table_stats()
    for table, count in stats.items():
        print(f"  {table:<25} {count:>10} rows")
    print("=" * 50)

    total = sum(c for c in results.values() if c > 0)
    print(f"\nTotal rows loaded: {total:,}")


if __name__ == "__main__":
    main()