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
└── server/
    └── index.js                    # Express server with API proxies
```

## 🔐 Security

- API keys are encrypted client-side before storage
- Each user's keys are stored in their own Firestore document
- Access restricted to `@google.com` domain

## 📄 License

Apache License 2.0

---

*Built with 💜 using Angular, Firebase, and Gemini AI*
