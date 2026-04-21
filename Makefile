.PHONY: api api-dev api-test api-deploy api-logs

# ── API ──────────────────────────────────────────
api-dev:
	uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

api:
	uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 2

api-test:
	pytest tests/test_api/ -v

api-logs:
	sudo journalctl -u mbta-api -f

api-restart:
	sudo systemctl restart mbta-api

api-status:
	sudo systemctl status mbta-api

# ── Pipeline ─────────────────────────────────────
airflow-start:
	airflow webserver -p 8080 -D && airflow scheduler -D

dbt-run:
	cd dbt && dbt run

dbt-test:
	cd dbt && dbt test

# ── All ──────────────────────────────────────────
status:
	@echo "=== Airflow ===" && sudo systemctl status airflow-webserver --no-pager
	@echo ""
	@echo "=== FastAPI ===" && sudo systemctl status mbta-api --no-pager

logs-all:
	@echo "=== FastAPI Logs ===" && sudo journalctl -u mbta-api -n 20 --no-pager
	@echo ""
	@echo "=== Airflow Logs ===" && sudo journalctl -u airflow-webserver -n 20 --no-pager