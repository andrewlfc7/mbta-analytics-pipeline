"""DAG: Run dbt transformations hourly."""

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

with DAG(
    dag_id="dbt_transforms",
    default_args=default_args,
    description="Run dbt staging → intermediate → mart transformations",
    schedule_interval="0 * * * *",
    start_date=datetime(2025, 1, 1),
    catchup=False,
    tags=["mbta", "dbt", "transforms"],
) as dag:

    dbt_staging = BashOperator(
        task_id="dbt_run_staging",
        bash_command=f"cd {DBT_DIR} && dbt run --select staging --profiles-dir {DBT_DIR}",
    )

    dbt_intermediate = BashOperator(
        task_id="dbt_run_intermediate",
        bash_command=f"cd {DBT_DIR} && dbt run --select intermediate --profiles-dir {DBT_DIR}",
    )

    dbt_marts = BashOperator(
        task_id="dbt_run_marts",
        bash_command=f"cd {DBT_DIR} && dbt run --select marts --profiles-dir {DBT_DIR}",
    )

    dbt_test = BashOperator(
        task_id="dbt_test",
        bash_command=f"cd {DBT_DIR} && dbt test --profiles-dir {DBT_DIR}",
    )

    dbt_staging >> dbt_intermediate >> dbt_marts >> dbt_test
