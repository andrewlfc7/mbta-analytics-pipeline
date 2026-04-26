#!/bin/bash
# Setup FastAPI on GCP e2-micro

echo "=== Setting up MBTA Analytics API ==="

# Install dependencies
pip install -r requirements-api.txt

# Create cache directory
mkdir -p /tmp/mbta_api_cache

# Create .env if not exists
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env — please fill in your values"
fi

# Create systemd service for auto-start
sudo tee /etc/systemd/system/mbta-api.service > /dev/null <<EOF
[Unit]
Description=MBTA Analytics FastAPI
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
Environment="PATH=$(pwd)/venv/bin:/usr/local/bin:/usr/bin"
EnvironmentFile=$(pwd)/.env
ExecStart=$(pwd)/venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 2 --loop uvloop --http httptools
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable mbta-api
sudo systemctl start mbta-api

echo "=== API service created ==="
echo "Status: sudo systemctl status mbta-api"
echo "Logs:   sudo journalctl -u mbta-api -f"
