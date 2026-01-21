#!/bin/bash
# Deploy script for Grumble Sync Service

set -e

# Configuration
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project)}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="grumble-sync"

echo "🚀 Deploying Grumble Sync Service..."
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo ""

# Check if secrets exist
echo "📋 Checking secrets..."
for secret in twitter-token github-token gemini-key; do
    if ! gcloud secrets describe $secret --project=$PROJECT_ID &>/dev/null; then
        echo "⚠️  Secret '$secret' not found. Create it with:"
        echo "   echo -n 'YOUR_VALUE' | gcloud secrets create $secret --data-file=-"
        exit 1
    fi
done
echo "✅ All secrets found"
echo ""

# Ensure Cloud Run SA has Firestore access
echo "🔐 Configuring IAM permissions..."
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$COMPUTE_SA" \
    --role="roles/datastore.user" \
    --condition=None \
    --quiet 2>/dev/null || true
echo "✅ IAM configured"
echo ""

# Deploy to Cloud Run
echo "🐳 Building and deploying..."
gcloud run deploy $SERVICE_NAME \
    --source . \
    --region $REGION \
    --project $PROJECT_ID \
    --platform managed \
    --no-allow-unauthenticated \
    --max-instances=1 \
    --memory=512Mi \
    --timeout=540s \
    --set-secrets="TWITTER_BEARER_TOKEN=twitter-token:latest,GITHUB_TOKEN=github-token:latest,GEMINI_API_KEY=gemini-key:latest"

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --project=$PROJECT_ID --format='value(status.url)')
echo ""
echo "✅ Deployed successfully!"
echo "   URL: $SERVICE_URL"
echo ""

# Create scheduler job if it doesn't exist
echo "⏰ Setting up Cloud Scheduler..."
SCHEDULER_SA="grumble-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"

# Create service account if needed
if ! gcloud iam service-accounts describe $SCHEDULER_SA --project=$PROJECT_ID &>/dev/null; then
    echo "   Creating service account..."
    gcloud iam service-accounts create grumble-scheduler \
        --display-name="Grumble Scheduler SA" \
        --project=$PROJECT_ID
fi

# Grant invoker role
gcloud run services add-iam-policy-binding $SERVICE_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --member="serviceAccount:$SCHEDULER_SA" \
    --role="roles/run.invoker" \
    --quiet

# Create or update scheduler job
JOB_NAME="grumble-sync-job"
if gcloud scheduler jobs describe $JOB_NAME --location=$REGION --project=$PROJECT_ID &>/dev/null; then
    echo "   Updating existing scheduler job..."
    gcloud scheduler jobs update http $JOB_NAME \
        --location=$REGION \
        --project=$PROJECT_ID \
        --schedule="*/30 * * * *" \
        --uri="${SERVICE_URL}/sync" \
        --http-method=POST \
        --oidc-service-account-email=$SCHEDULER_SA \
        --oidc-token-audience=$SERVICE_URL
else
    echo "   Creating scheduler job..."
    gcloud scheduler jobs create http $JOB_NAME \
        --location=$REGION \
        --project=$PROJECT_ID \
        --schedule="*/30 * * * *" \
        --uri="${SERVICE_URL}/sync" \
        --http-method=POST \
        --oidc-service-account-email=$SCHEDULER_SA \
        --oidc-token-audience=$SERVICE_URL
fi

echo ""
echo "🎉 All done!"
echo "   Service: $SERVICE_URL"
echo "   Scheduler: Every 30 minutes"
echo ""
echo "Test with: curl -X GET ${SERVICE_URL}/health"
