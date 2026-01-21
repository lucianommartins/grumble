# 🔍 Grumble

**User Feedback & Complaint Intelligence Platform**

An industrial-grade tool for monitoring, analyzing, and understanding user feedback from multiple sources using AI-powered sentiment analysis.

> ⚠️ **Disclaimer**: This is an experimental prototype, NOT an official Google product. It is provided AS-IS without support.

## ✨ Features

- **Multi-Source Monitoring**
  - 🐦 Twitter/X keyword search
  - 🐙 GitHub Issues & Discussions
  - 💬 Discourse forums

- **AI-Powered Analysis**
  - Sentiment analysis (Positive/Neutral/Negative)
  - Automatic categorization (Bug, Feature Request, Question, etc.)
  - Smart grouping of related feedback

- **Modern UI**
  - Real-time filtering by source and sentiment
  - Dark/Light theme support
  - Responsive design

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Angular CLI
- Firebase project with Firestore database named `grumble`

### Required API Keys

| API Key | Required | How to Get |
|---------|----------|------------|
| **Gemini API Key** | ✅ Yes | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| **GitHub PAT** | ✅ Yes | [GitHub Settings](https://github.com/settings/tokens) - needs `repo` scope |
| **Twitter Bearer Token** | ❌ Optional | [Twitter Developer Portal](https://developer.twitter.com/) |

### GitHub PAT Permissions

For Classic tokens, select:
- ✅ `repo` - Full control of repositories (includes Issues & Discussions)

### Installation

```bash
# Clone the repository
git clone https://github.com/user/grumble.git
cd grumble

# Install dependencies
npm install

# Start development server
npm start
```

### Configuration

1. Open the app in your browser
2. Sign in with a `@google.com` email
3. Click ⚙️ Settings
4. Enter your API keys

## 🏗️ Architecture

Built on Angular 21 with signals-based state management:

```
grumble/
├── src/app/
│   ├── services/
│   │   ├── github.service.ts       # GitHub API integration
│   │   ├── twitter-search.service.ts  # Twitter API v2
│   │   ├── discourse.service.ts    # Discourse forum scraping
│   │   ├── feedback.service.ts     # Orchestration layer
│   │   └── sentiment.service.ts    # Gemini-powered analysis
│   ├── components/
│   │   ├── feedback-dashboard/     # Main dashboard
│   │   ├── sidebar/                # Source management
│   │   └── settings/               # API key configuration
│   └── models/
│       └── feedback.model.ts       # Data models
├── server/
│   └── index.js                    # Express server with API proxies
└── deploy/
    ├── webapp/                     # Angular app deployment
    └── sync-service/               # Python sync service
```

## 🔄 Sync Service (Backend)

O Grumble possui um serviço backend opcional que sincroniza as sources automaticamente via Cloud Scheduler.

### Componentes

| Componente | Descrição |
|------------|-----------|
| **Webapp** | Angular app no Cloud Run (`deploy/webapp/`) |
| **Sync Service** | Python backend no Cloud Run (`deploy/sync-service/`) |
| **Scheduler** | Cloud Scheduler invoca sync a cada 30min |

### Deploy do Sync Service

```bash
cd deploy/sync-service
gcloud run deploy grumble-sync \
  --source . \
  --region us-central1 \
  --max-instances=1 \
  --set-secrets=TWITTER_BEARER_TOKEN=twitter-token:latest,GITHUB_TOKEN=github-token:latest,GEMINI_API_KEY=gemini-key:latest
```

### Cloud Scheduler Setup

```bash
gcloud scheduler jobs create http grumble-sync-job \
  --location=us-central1 \
  --schedule="*/30 * * * *" \
  --uri="https://YOUR-SERVICE-URL/sync" \
  --http-method=POST \
  --oidc-service-account-email=YOUR-SA@PROJECT.iam.gserviceaccount.com
```

## 🔐 Security

- API keys are encrypted client-side before storage
- Each user's keys are stored in their own Firestore document
- Access restricted to `@google.com` domain

## 👥 User Roles

Grumble supports two user roles managed via Firestore:

| Role | Badge | Permissions |
|------|-------|-------------|
| **Admin** | 🔴 Red | Can sync sources, analyze feedback |
| **Reporter** | 🟢 Green | Can only view/analyze cached data |

### Configuring Admins

Create the following structure in Firestore:

```
Collection: config
  └── Document: roles
        └── admins: ["email1@google.com", "email2@google.com"]
```

Users whose emails are in the `admins` array will be Admins; all others are Reporters.

## 📄 License

Apache License 2.0

---

*Built with 💜 using Angular, Firebase, and Gemini AI*
