#!/bin/bash

# ============================================
# Custom Domain Setup for CS Intelligence System
# ============================================
# Frontend: cs.motionlabs.kr
# API: api-cs.motionlabs.kr
# ============================================

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
REGION="${GCP_REGION:-asia-northeast3}"

# Custom Domains
FRONTEND_DOMAIN="cs.motionlabs.kr"
API_DOMAIN="api-cs.motionlabs.kr"

echo "=========================================="
echo "Custom Domain Setup"
echo "=========================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""
echo "Domains to configure:"
echo "  Frontend: ${FRONTEND_DOMAIN} -> cs-frontend"
echo "  API:      ${API_DOMAIN} -> cs-dashboard-api"
echo ""

# Set project
gcloud config set project $PROJECT_ID

# ============================================
# Step 1: Verify Domain Ownership
# ============================================
echo "Step 1: Domain Verification"
echo "-------------------------------------------"
echo "Before proceeding, verify domain ownership in Google Search Console:"
echo "  https://search.google.com/search-console"
echo ""
echo "Add TXT record to your DNS:"
echo "  Host: @ or motionlabs.kr"
echo "  Value: (provided by Google Search Console)"
echo ""
read -p "Press Enter after domain verification is complete..."

# ============================================
# Step 2: Create Domain Mappings
# ============================================
echo ""
echo "Step 2: Creating Domain Mappings..."
echo "-------------------------------------------"

# Frontend domain mapping
echo "  Mapping ${FRONTEND_DOMAIN} to cs-frontend..."
gcloud beta run domain-mappings create \
    --service cs-frontend \
    --domain ${FRONTEND_DOMAIN} \
    --region ${REGION} 2>/dev/null || echo "  (Domain mapping may already exist)"

# API domain mapping
echo "  Mapping ${API_DOMAIN} to cs-dashboard-api..."
gcloud beta run domain-mappings create \
    --service cs-dashboard-api \
    --domain ${API_DOMAIN} \
    --region ${REGION} 2>/dev/null || echo "  (Domain mapping may already exist)"

# ============================================
# Step 3: Get DNS Records
# ============================================
echo ""
echo "Step 3: DNS Configuration Required"
echo "-------------------------------------------"
echo ""
echo "Add the following DNS records in AWS Route 53:"
echo ""
echo "For ${FRONTEND_DOMAIN}:"
gcloud beta run domain-mappings describe \
    --domain ${FRONTEND_DOMAIN} \
    --region ${REGION} \
    --format="table(resourceRecords.type,resourceRecords.rrdata)" 2>/dev/null || echo "  CNAME -> ghs.googlehosted.com"
echo ""
echo "For ${API_DOMAIN}:"
gcloud beta run domain-mappings describe \
    --domain ${API_DOMAIN} \
    --region ${REGION} \
    --format="table(resourceRecords.type,resourceRecords.rrdata)" 2>/dev/null || echo "  CNAME -> ghs.googlehosted.com"

echo ""
echo "=========================================="
echo "DNS Setup Instructions (AWS Route 53)"
echo "=========================================="
echo ""
echo "1. Go to AWS Route 53 Console"
echo "2. Select 'motionlabs.kr' hosted zone"
echo "3. Create the following records:"
echo ""
echo "   Record 1 (Frontend):"
echo "   - Name: cs"
echo "   - Type: CNAME"
echo "   - Value: ghs.googlehosted.com"
echo "   - TTL: 300"
echo ""
echo "   Record 2 (API):"
echo "   - Name: api-cs"
echo "   - Type: CNAME"
echo "   - Value: ghs.googlehosted.com"
echo "   - TTL: 300"
echo ""
echo "4. Wait for DNS propagation (usually 5-10 minutes)"
echo "5. SSL certificates will be auto-provisioned by Google"
echo ""
echo "=========================================="
echo "Final URLs (after DNS propagation):"
echo "  Frontend: https://${FRONTEND_DOMAIN}"
echo "  API:      https://${API_DOMAIN}"
echo "=========================================="
