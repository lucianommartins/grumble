# Grumble Sync Service

Backend service for automated source synchronization.

## Prerequisites

1. **GCP Project** with billing enabled
2. **APIs enabled**: Cloud Run, Cloud Scheduler, Secret Manager, Firestore
3. **gcloud CLI** authenticated

## Setup Secrets

Before deploying, create secrets in Secret Manager:

```bash
# Twitter Bearer Token
echo -n "YOUR_TWITTER_TOKEN" | gcloud secrets create twitter-token --data-file=-

# GitHub Personal Access Token
echo -n "YOUR_GITHUB_TOKEN" | gcloud secrets create github-token --data-file=-

# Gemini API Key
echo -n "YOUR_GEMINI_KEY" | gcloud secrets create gemini-key --data-file=-
```

## Deploy

```bash
./deploy.sh
```

The script will:
1. ✅ Verify secrets exist
2. ✅ Deploy to Cloud Run
3. ✅ Create scheduler service account
4. ✅ Configure Cloud Scheduler (every 30 min)

## Manual Deploy

```bash
gcloud run deploy grumble-sync \
  --source . \
  --region us-central1 \
  --max-instances=1 \
  --set-secrets=TWITTER_BEARER_TOKEN=twitter-token:latest,GITHUB_TOKEN=github-token:latest,GEMINI_API_KEY=gemini-key:latest
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/sync` | POST | Trigger sync (requires OIDC auth) |

## Architecture

```
POST /sync
    │
    ├── Phase 1: Sync (Twitter, GitHub, Discourse)
    ├── Phase 2: Sentiment Analysis (Gemini)
    ├── Phase 3: Grouping (Gemini)
    ├── Phase 4: Group Deduplication
    ├── Phase 5: Translation (en, pt, es)
    └── Phase 6: Save to Firestore
```

## Concurrency Control

- `--max-instances=1` limits to single instance
- Firestore distributed lock prevents overlapping runs
