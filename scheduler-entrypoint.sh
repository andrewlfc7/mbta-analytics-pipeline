#!/bin/bash
set -e
echo "=== Pre-flight permission fix ==="
chown -R 1001:0 /opt/airflow/logs
find /opt/airflow/logs -type d -exec chmod 2775 {} +
find /opt/airflow/logs -type f -exec chmod 664 {} + 2>/dev/null || true
TODAY=$(date -u +%Y-%m-%d)
mkdir -p "/opt/airflow/logs/scheduler/$TODAY"
chown 1001:0 "/opt/airflow/logs/scheduler/$TODAY"
chmod 2775 "/opt/airflow/logs/scheduler/$TODAY"
ls -lan /opt/airflow/logs/scheduler/
ls -lan "/opt/airflow/logs/scheduler/$TODAY/"
echo "=== Starting scheduler as UID 1001 ==="
if command -v gosu > /dev/null 2>&1; then
  exec gosu 1001:0 airflow scheduler
else
  exec su -s /bin/bash -c "airflow scheduler" airflow
fi
