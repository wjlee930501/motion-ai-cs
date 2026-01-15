#!/bin/bash

# ============================================
# Manual Deployment Script for CS Intelligence System
# ============================================

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
REGION="${GCP_REGION:-asia-northeast3}"
CLOUD_SQL_INSTANCE="cs-intelligence-db"
TAG="${1:-latest}"

# Custom Domain (fixed URL)
FRONTEND_DOMAIN="cs.motionlabs.kr"
API_DOMAIN="api-cs.motionlabs.kr"

echo "=========================================="
echo "CS Intelligence System - Manual Deploy"
echo "=========================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Tag: $TAG"
echo ""

# Set project
gcloud config set project $PROJECT_ID

# Configure docker for Artifact Registry
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

# Get Cloud SQL connection name
CLOUD_SQL_CONNECTION=$(gcloud sql instances describe $CLOUD_SQL_INSTANCE --format="value(connectionName)")

# ============================================
# Build Images
# ============================================
echo "Building Docker images..."

# Dashboard API
echo "  Building Dashboard API..."
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/cs-intelligence/cs-dashboard-api:${TAG} \
    -f server-py/Dockerfile ./server-py

# Ingest API
echo "  Building Ingest API..."
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/cs-intelligence/cs-ingest-api:${TAG} \
    -f server-py/Dockerfile ./server-py

# Worker
echo "  Building Worker..."
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/cs-intelligence/cs-worker:${TAG} \
    -f server-py/Dockerfile.worker ./server-py

# Frontend - get Dashboard API URL first
DASHBOARD_URL=$(gcloud run services describe cs-dashboard-api --region=${REGION} --format="value(status.url)" 2>/dev/null || echo "https://cs-dashboard-api-${PROJECT_ID}.${REGION}.run.app")
echo "  Building Frontend (API URL: ${DASHBOARD_URL})..."
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/cs-intelligence/cs-frontend:${TAG} \
    --build-arg VITE_API_URL=${DASHBOARD_URL} \
    -f ChatLoggerWeb/Dockerfile ./ChatLoggerWeb

# ============================================
# Push Images
# ============================================
echo ""
echo "Pushing images to Artifact Registry..."
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/cs-intelligence/cs-dashboard-api:${TAG}
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/cs-intelligence/cs-ingest-api:${TAG}
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/cs-intelligence/cs-worker:${TAG}
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/cs-intelligence/cs-frontend:${TAG}

# ============================================
# Deploy to Cloud Run
# ============================================
echo ""
echo "Deploying to Cloud Run..."

# Deploy Dashboard API
echo "  Deploying Dashboard API..."
gcloud run deploy cs-dashboard-api \
    --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/cs-intelligence/cs-dashboard-api:${TAG} \
    --region ${REGION} \
    --platform managed \
    --allow-unauthenticated \
    --add-cloudsql-instances ${CLOUD_SQL_CONNECTION} \
    --set-secrets DATABASE_URL=cs-database-url:latest,JWT_SECRET=cs-jwt-secret:latest,OPENAI_API_KEY=openai-api-key:latest \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10

# Deploy Ingest API
echo "  Deploying Ingest API..."
gcloud run deploy cs-ingest-api \
    --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/cs-intelligence/cs-ingest-api:${TAG} \
    --region ${REGION} \
    --platform managed \
    --allow-unauthenticated \
    --add-cloudsql-instances ${CLOUD_SQL_CONNECTION} \
    --set-secrets DATABASE_URL=cs-database-url:latest \
    --memory 256Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 20 \
    --command "uvicorn" \
    --args "ingest_api.main:app,--host,0.0.0.0,--port,8080"

# Deploy Frontend
echo "  Deploying Frontend..."
gcloud run deploy cs-frontend \
    --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/cs-intelligence/cs-frontend:${TAG} \
    --region ${REGION} \
    --platform managed \
    --allow-unauthenticated \
    --memory 256Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 5

# ============================================
# Get Service URLs
# ============================================
echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""

DASHBOARD_URL=$(gcloud run services describe cs-dashboard-api --region=${REGION} --format="value(status.url)")
INGEST_URL=$(gcloud run services describe cs-ingest-api --region=${REGION} --format="value(status.url)")
FRONTEND_URL=$(gcloud run services describe cs-frontend --region=${REGION} --format="value(status.url)")

echo "Service URLs:"
echo "  Dashboard API: ${DASHBOARD_URL}"
echo "  Ingest API:    ${INGEST_URL}"
echo "  Frontend:      ${FRONTEND_URL}"
echo ""

# ============================================
# Custom Domain Mapping (Optional)
# ============================================
echo "Custom Domain Setup:"
echo "  Frontend: https://${FRONTEND_DOMAIN}"
echo "  API:      https://${API_DOMAIN}"
echo ""
echo "To set up custom domain mapping, run:"
echo "  ./gcp/setup-domain.sh"
echo ""
