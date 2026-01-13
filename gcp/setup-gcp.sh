#!/bin/bash

# ============================================
# GCP Project Setup Script for CS Intelligence System
# ============================================

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
REGION="${GCP_REGION:-asia-northeast3}"
ZONE="${GCP_ZONE:-asia-northeast3-a}"
CLOUD_SQL_INSTANCE="cs-intelligence-db"
DB_NAME="cs_intelligence"
DB_USER="cs_admin"

echo "=========================================="
echo "CS Intelligence System - GCP Setup"
echo "=========================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed"
    exit 1
fi

# Set project
echo "1. Setting GCP project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "2. Enabling required APIs..."
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    sqladmin.googleapis.com \
    secretmanager.googleapis.com \
    artifactregistry.googleapis.com \
    cloudresourcemanager.googleapis.com

# Create Artifact Registry repository
echo "3. Creating Artifact Registry repository..."
gcloud artifacts repositories create cs-intelligence \
    --repository-format=docker \
    --location=$REGION \
    --description="CS Intelligence System Docker images" \
    || echo "Repository already exists"

# Create Cloud SQL instance
echo "4. Creating Cloud SQL PostgreSQL instance..."
gcloud sql instances describe $CLOUD_SQL_INSTANCE > /dev/null 2>&1 || \
gcloud sql instances create $CLOUD_SQL_INSTANCE \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=$REGION \
    --storage-type=SSD \
    --storage-size=10GB \
    --storage-auto-increase \
    --backup \
    --backup-start-time=03:00

# Wait for instance to be ready
echo "   Waiting for Cloud SQL instance to be ready..."
gcloud sql instances describe $CLOUD_SQL_INSTANCE --format="value(state)" | grep -q RUNNABLE || sleep 60

# Create database
echo "5. Creating database..."
gcloud sql databases create $DB_NAME \
    --instance=$CLOUD_SQL_INSTANCE \
    || echo "Database already exists"

# Generate password and create user
echo "6. Creating database user..."
DB_PASSWORD=$(openssl rand -base64 24)
gcloud sql users create $DB_USER \
    --instance=$CLOUD_SQL_INSTANCE \
    --password=$DB_PASSWORD \
    || echo "User already exists"

# Get Cloud SQL connection name
CLOUD_SQL_CONNECTION=$(gcloud sql instances describe $CLOUD_SQL_INSTANCE --format="value(connectionName)")

# Create secrets in Secret Manager
echo "7. Creating secrets in Secret Manager..."

# Database URL secret
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${CLOUD_SQL_CONNECTION}"
echo -n "$DATABASE_URL" | gcloud secrets create cs-database-url --data-file=- \
    || gcloud secrets versions add cs-database-url --data-file=- <<< "$DATABASE_URL"

# JWT Secret
JWT_SECRET=$(openssl rand -base64 32)
echo -n "$JWT_SECRET" | gcloud secrets create cs-jwt-secret --data-file=- \
    || gcloud secrets versions add cs-jwt-secret --data-file=- <<< "$JWT_SECRET"

# Note: OpenAI API key should be added manually
echo ""
echo "Note: Add your OpenAI API key manually:"
echo "  gcloud secrets create openai-api-key --data-file=- <<< 'your-api-key'"

# Grant Cloud Run access to secrets
echo "8. Granting Cloud Run access to secrets..."
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for secret in cs-database-url cs-jwt-secret openai-api-key; do
    gcloud secrets add-iam-policy-binding $secret \
        --member="serviceAccount:${SERVICE_ACCOUNT}" \
        --role="roles/secretmanager.secretAccessor" \
        2>/dev/null || true
done

# Grant Cloud Build permissions
echo "9. Granting Cloud Build permissions..."
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${CLOUD_BUILD_SA}" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${CLOUD_BUILD_SA}" \
    --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${CLOUD_BUILD_SA}" \
    --role="roles/cloudsql.client"

echo ""
echo "=========================================="
echo "GCP Setup Complete!"
echo "=========================================="
echo ""
echo "Cloud SQL Instance: $CLOUD_SQL_INSTANCE"
echo "Cloud SQL Connection: $CLOUD_SQL_CONNECTION"
echo "Database: $DB_NAME"
echo "Database User: $DB_USER"
echo ""
echo "Next Steps:"
echo "1. Add your OpenAI API key:"
echo "   gcloud secrets create openai-api-key --data-file=- <<< 'sk-your-api-key'"
echo ""
echo "2. Deploy using Cloud Build:"
echo "   gcloud builds submit --config=gcp/cloudbuild.yaml"
echo ""
echo "3. Or deploy manually using:"
echo "   ./gcp/deploy.sh"
echo ""
