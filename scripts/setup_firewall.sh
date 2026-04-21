#!/bin/bash
# Open port 8000 for FastAPI on GCP

echo "=== Setting up firewall rule for API ==="

gcloud compute firewall-rules create allow-fastapi \
    --direction=INGRESS \
    --priority=1000 \
    --network=default \
    --action=ALLOW \
    --rules=tcp:8000 \
    --source-ranges=0.0.0.0/0 \
    --target-tags=http-server \
    --description="Allow FastAPI traffic on port 8000"

echo "=== Firewall rule created ==="
echo "API will be accessible at http://http://34.30.107.174/:8000"
echo "Swagger docs at http://http://34.30.107.174/:8000/docs"