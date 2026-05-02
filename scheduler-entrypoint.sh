#!/bin/bash
set -e

echo "=== Scheduler pre-flight ==="
TODAY=$(date -u +%Y-%m-%d)

mkdir -p "/opt/airflow/logs/scheduler/$TODAY"
chmod 2775 "/opt/airflow/logs/scheduler/$TODAY" 2>/dev/null || true

mkdir -p /tmp/dbt_logs /tmp/dbt_target
chmod 775 /tmp/dbt_logs /tmp/dbt_target 2>/dev/null || true

echo "=== Runtime identity ==="
id
getent passwd "$(id -u)" || true

echo "=== Scheduler log dir ==="
ls -lan /opt/airflow/logs/scheduler/ || true
ls -lan "/opt/airflow/logs/scheduler/$TODAY/" || true

echo "=== Starting scheduler ==="
exec airflow scheduler
