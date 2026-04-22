"""DuckDB loader — loads raw parquet files into DuckDB tables for local development."""

import time
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

    DEDUPE_KEYS = {
        "predictions": ["prediction_id", "extracted_at"],
        "vehicles": ["vehicle_id", "extracted_at"],
        "alerts": ["alert_id", "extracted_at"],
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

    @staticmethod
    def _quote_identifier(identifier: str) -> str:
        return f'"{identifier.replace(chr(34), chr(34) * 2)}"'

    def _query_columns(self, conn: duckdb.DuckDBPyConnection, query: str) -> list[str]:
        """Return column names produced by a query."""
        return [row[0] for row in conn.execute(f"DESCRIBE {query}").fetchall()]

    def _table_columns(self, conn: duckdb.DuckDBPyConnection, table_name: str) -> list[str]:
        """Return column names in an existing table."""
        return [row[0] for row in conn.execute(f"DESCRIBE {table_name}").fetchall()]

    def _dedupe_existing_table(
        self,
        conn: duckdb.DuckDBPyConnection,
        entity: str,
        table_name: str,
    ) -> int:
        """Remove duplicate raw fact rows by entity key and extraction timestamp."""
        dedupe_keys = self.DEDUPE_KEYS.get(entity)
        if not dedupe_keys:
            return conn.execute(f"SELECT count(*) FROM {table_name}").fetchone()[0]

        columns = self._table_columns(conn, table_name)
        if not all(key in columns for key in dedupe_keys):
            return conn.execute(f"SELECT count(*) FROM {table_name}").fetchone()[0]

        column_list = ", ".join(self._quote_identifier(col) for col in columns)
        key_list = ", ".join(self._quote_identifier(key) for key in dedupe_keys)

        before_count = conn.execute(f"SELECT count(*) FROM {table_name}").fetchone()[0]
        conn.execute(
            f"""
            CREATE OR REPLACE TABLE {table_name} AS
            SELECT {column_list}
            FROM (
                SELECT
                    *,
                    row_number() OVER (
                        PARTITION BY {key_list}
                        ORDER BY {key_list}
                    ) AS _dedupe_rank
                FROM {table_name}
            )
            WHERE _dedupe_rank = 1
            """
        )
        after_count = conn.execute(f"SELECT count(*) FROM {table_name}").fetchone()[0]

        if before_count != after_count:
            self.logger.info(
                "deduped",
                entity=entity,
                table=table_name,
                removed=before_count - after_count,
                rows=after_count,
            )

        return after_count

    def dedupe_entity(self, entity: str) -> int:
        """Remove duplicate rows from an existing raw append table."""
        if entity not in self.ENTITIES:
            valid = list(self.ENTITIES.keys())
            raise ValueError(f"Unknown entity: {entity}. Expected one of {valid}")

        table = self.ENTITIES[entity]["table"]
        table_name = f"raw_mbta.{table}"

        conn = self.get_connection()
        try:
            self._create_schema(conn)
            table_exists = conn.execute(
                """
                SELECT count(*) FROM information_schema.tables
                WHERE table_schema = 'raw_mbta'
                  AND table_name = ?
                """,
                [table],
            ).fetchone()[0] > 0

            if not table_exists:
                return 0

            return self._dedupe_existing_table(conn, entity, table_name)
        finally:
            conn.close()

    def load_parquet(
        self,
        entity: str,
        parquet_path: str | None = None,
        glob_pattern: str | None = None,
        max_retries: int = 3,
        retry_delay: float = 5.0,
    ) -> int:
        if entity not in self.ENTITIES:
            valid = list(self.ENTITIES.keys())
            raise ValueError(f"Unknown entity: {entity}. Expected one of {valid}")

        entity_config = self.ENTITIES[entity]

        table_name = f"raw_mbta.{entity_config['table']}"
        mode = entity_config["mode"]

        if parquet_path:
            source = f"'{parquet_path}'"
        elif glob_pattern:
            source = f"'{glob_pattern}'"
        else:
            raw_path = self.config.local.raw_path
            source = f"'{raw_path}/{entity}/**/*.parquet'"

        for attempt in range(1, max_retries + 1):
            try:
                conn = self.get_connection()
                try:
                    self._create_schema(conn)

                    if mode == "replace":
                        conn.execute(f"DROP TABLE IF EXISTS {table_name}")
                        conn.execute(
                            f"CREATE TABLE {table_name} AS "
                            f"SELECT * FROM read_parquet({source}, union_by_name=true)"
                        )
                        row_count = conn.execute(f"SELECT count(*) FROM {table_name}").fetchone()[0]
                    elif mode == "append":
                        table_exists = conn.execute(
                            f"""
                            SELECT count(*) FROM information_schema.tables
                            WHERE table_schema = 'raw_mbta'
                              AND table_name = '{entity_config["table"]}'
                            """
                        ).fetchone()[0] > 0

                        if not table_exists:
                            conn.execute(
                                f"CREATE TABLE {table_name} AS "
                                f"SELECT DISTINCT * FROM read_parquet({source}, union_by_name=true)"
                            )
                        else:
                            source_query = (
                                f"SELECT DISTINCT * "
                                f"FROM read_parquet({source}, union_by_name=true)"
                            )
                            source_columns = self._query_columns(conn, source_query)
                            target_columns = self._table_columns(conn, table_name)
                            insert_columns = [c for c in target_columns if c in source_columns]

                            if not insert_columns:
                                raise ValueError(f"No loadable columns found for {entity}")

                            dedupe_keys = self.DEDUPE_KEYS.get(entity, [])
                            can_dedupe = all(
                                key in source_columns and key in target_columns
                                for key in dedupe_keys
                            )

                            quoted_insert_columns = ", ".join(
                                self._quote_identifier(c) for c in insert_columns
                            )
                            source_select = ", ".join(
                                f"source.{self._quote_identifier(c)}" for c in insert_columns
                            )

                            if can_dedupe:
                                join_predicates = " AND ".join(
                                    f"target.{self._quote_identifier(key)} = "
                                    f"source.{self._quote_identifier(key)}"
                                    for key in dedupe_keys
                                )
                                conn.execute(
                                    f"""
                                    INSERT INTO {table_name} ({quoted_insert_columns})
                                    SELECT {source_select}
                                    FROM ({source_query}) AS source
                                    WHERE NOT EXISTS (
                                        SELECT 1
                                        FROM {table_name} AS target
                                        WHERE {join_predicates}
                                    )
                                    """
                                )
                            else:
                                conn.execute(
                                    f"""
                                    INSERT INTO {table_name} ({quoted_insert_columns})
                                    SELECT {source_select}
                                    FROM ({source_query}) AS source
                                    """
                                )

                        row_count = self._dedupe_existing_table(conn, entity, table_name)
                    else:
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

            except Exception as e:
                if "lock" in str(e).lower() and attempt < max_retries:
                    self.logger.warning(
                        "db_locked_retrying",
                        entity=entity,
                        attempt=attempt,
                        retry_in=retry_delay,
                    )
                    time.sleep(retry_delay)
                else:
                    raise

        return 0

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
