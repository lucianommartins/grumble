#!/bin/bash
# Grumble Cloud Run Deployment Script
# Run this from the project root directory (grumble/)

set -e

# ============================================
# CONFIGURATION
# ============================================
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-lucianomartins-demos-345000}"
SERVICE_NAME="grumble"
REGION="us-central1"

# Firebase Configuration - read from local environment.prod.ts
ENV_FILE="src/environments/environment.prod.ts"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: $ENV_FILE not found"
    echo "   Create this file locally with your Firebase config"
    exit 1
fi

# Extract values from environment.prod.ts
extract_value() {
    grep -o "$1: '[^']*'" "$ENV_FILE" | head -1 | sed "s/$1: '//;s/'$//"
}

APP_SECRET=$(extract_value "appSecret")
FIREBASE_API_KEY=$(extract_value "apiKey")
FIREBASE_AUTH_DOMAIN=$(extract_value "authDomain")
FIREBASE_PROJECT_ID=$(extract_value "projectId")
FIREBASE_STORAGE_BUCKET=$(extract_value "storageBucket")
FIREBASE_MESSAGING_SENDER_ID=$(extract_value "messagingSenderId")
FIREBASE_APP_ID=$(extract_value "appId")

# Validate required values
if [ -z "$FIREBASE_API_KEY" ]; then
    echo "❌ Error: Could not extract Firebase config from $ENV_FILE"
    exit 1
fi

# ============================================
# DEPLOYMENT
# ============================================
echo "🚀 Grumble Cloud Run Deployment"
echo "================================"
echo "Project: ${PROJECT_ID}"
echo "Service: ${SERVICE_NAME}"
echo "Region: ${REGION}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the grumble/ root directory"
    exit 1
fi

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI not found. Install from https://cloud.google.com/sdk"
    exit 1
fi

# Authenticate and set project
echo "📋 Setting Google Cloud project..."
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com

# Get project number for service account
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')

# Grant Cloud Build permission to deploy to Cloud Run
echo "🔐 Configuring IAM permissions for Cloud Build..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/run.admin" \
    --condition=None \
    --quiet 2>/dev/null || true

gcloud iam service-accounts add-iam-policy-binding \
    ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser" \
    --project=${PROJECT_ID} \
    --condition=None \
    --quiet 2>/dev/null || true

# Build and push container using Cloud Build
echo "🏗️ Building container with Cloud Build..."

# Generate a tag from git commit or timestamp
TAG=$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)
echo "📦 Image tag: ${TAG}"
echo "🔐 Firebase Project: ${FIREBASE_PROJECT_ID}"

gcloud builds submit \
    --config=deploy/cloudrun/cloudbuild.yaml \
    --substitutions=_SERVICE_NAME=${SERVICE_NAME},_REGION=${REGION},_TAG=${TAG},_APP_SECRET="${APP_SECRET}",_FIREBASE_API_KEY="${FIREBASE_API_KEY}",_FIREBASE_AUTH_DOMAIN="${FIREBASE_AUTH_DOMAIN}",_FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID}",_FIREBASE_STORAGE_BUCKET="${FIREBASE_STORAGE_BUCKET}",_FIREBASE_MESSAGING_SENDER_ID="${FIREBASE_MESSAGING_SENDER_ID}",_FIREBASE_APP_ID="${FIREBASE_APP_ID}" \
    .

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📍 Your service URL:"
gcloud run services describe ${SERVICE_NAME} --region=${REGION} --format='value(status.url)'
echo ""
echo "📝 Next steps:"
echo "   1. Configure custom domain: gcloud beta run domain-mappings create --service=${SERVICE_NAME} --domain=grumble.lmm.ai --region=${REGION}"
echo "   2. Update DNS records in GoDaddy as shown in Cloud Console"
