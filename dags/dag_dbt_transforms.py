"""DAG: Run dbt transformations hourly."""

import os
from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.bash import BashOperator

default_args = {
    "owner": "mbta",
    "depends_on_past": False,
    "email_on_failure": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=2),
}

DBT_DIR = "/opt/airflow/dbt_mbta"
DBT_TARGET = "prod" if os.getenv("MBTA_ENV") == "gcp" else "dev"

with DAG(
    dag_id="dbt_transforms",
    default_args=default_args,
    description="Run dbt staging → intermediate → mart transformations",
    schedule_interval="0 * * * *",
    start_date=datetime(2025, 1, 1),
    max_active_runs=1,
    max_active_tasks=2,
    dagrun_timeout=timedelta(minutes=20),
    catchup=False,
    tags=["mbta", "dbt", "transforms"],
) as dag:

    dbt_deps = BashOperator(
        task_id="dbt_deps",
        bash_command=f"cd {DBT_DIR} && dbt deps --profiles-dir {DBT_DIR}",
    )

    dbt_staging = BashOperator(
        task_id="dbt_run_staging",
        bash_command=(
            f"cd {DBT_DIR} && dbt run --select staging"
            f" --profiles-dir {DBT_DIR} --target {DBT_TARGET}"
        ),
    )

    dbt_intermediate = BashOperator(
        task_id="dbt_run_intermediate",
        bash_command=(
            f"cd {DBT_DIR} && dbt run --select intermediate"
            f" --profiles-dir {DBT_DIR} --target {DBT_TARGET}"
        ),
    )

    dbt_marts = BashOperator(
        task_id="dbt_run_marts",
        bash_command=(
            f"cd {DBT_DIR} && dbt run --select marts"
            f" --profiles-dir {DBT_DIR} --target {DBT_TARGET}"
        ),
    )

    dbt_test = BashOperator(
        task_id="dbt_test",
        bash_command=(
            f"cd {DBT_DIR} && dbt test"
            f" --profiles-dir {DBT_DIR} --target {DBT_TARGET}"
        ),
    )

    dbt_deps >> dbt_staging >> dbt_intermediate >> dbt_marts >> dbt_test
