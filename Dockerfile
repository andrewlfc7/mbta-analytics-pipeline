FROM apache/airflow:2.10.4-python3.12

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

USER airflow

COPY requirements-airflow.txt /tmp/requirements-airflow.txt
RUN pip install --no-cache-dir -r /tmp/requirements-airflow.txt

COPY src/ /opt/airflow/src/
COPY dags/ /opt/airflow/dags/