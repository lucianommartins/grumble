// Grumble Localization - English (en)
// This file contains all UI strings for the application

export const en = {
  // Common
  common: {
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    add: 'Add',
    loading: 'Loading...',
    saving: 'Saving...',
    validating: 'Validating...',
    error: 'Error',
    success: 'Success',
    required: 'required',
    optional: 'optional',
    enable: 'Enable',
    disable: 'Disable',
    edit: 'Edit',
    delete: 'Delete',
    confirm: 'Confirm',
  },

  // Auth
  auth: {
    signIn: 'Sign in with Google',
    signOut: 'Sign out',
    signingIn: 'Signing in...',
    domainRestriction: '⚠️ Access restricted to @google.com emails',
    authError: 'Authentication failed',
    notAuthenticated: 'User not authenticated',
  },

  // Settings
  settings: {
    title: '⚙️ Settings',
    description: 'Configure your API keys to use Grumble. Keys are stored securely and associated with your account.',
    geminiApiKey: '🔑 Gemini API Key',
    geminiHint: 'Get it from',
    geminiLinkText: 'Google AI Studio',
    twitterBearerToken: '🐦 Twitter Bearer Token',
    twitterHint: 'Get it from',
    twitterHintSuffix: '. Without this token, Twitter sources will be disabled.',
    twitterLinkText: 'Twitter Developer Portal',
    savedSuccess: '✅ Settings saved successfully!',
    saveError: 'Error saving settings',
    geminiInvalid: 'Gemini: Invalid API Key',
    geminiValidationError: 'Gemini: Validation failed',
    twitterInvalid: 'Twitter: Invalid Bearer Token',
    twitterValidationError: 'Twitter: Validation failed',
    language: 'Language',
  },

  // Errors
  errors: {
    geminiKeyRequired: 'Gemini API key not configured. Please configure it in ⚙️ Settings.',
    twitterTokenRequired: 'Twitter Bearer Token not configured. Please configure it in ⚙️ Settings.',
    networkError: 'Network error. Please check your connection.',
    unknownError: 'An unexpected error occurred.',
  },

  // Header
  header: {
    poweredBy: 'Gemini 3.0 Flash Powered',
    settings: 'Settings',
    contentCreated: 'Content created by all users',
    contentsGenerated: 'contents generated',
  },

  // Login
  login: {
    welcome: 'Welcome to',
    appName: 'Grumble',
    tagline: 'Monitor and analyze user feedback about Gemini API',
    feature1Title: 'Multi-source',
    feature1Desc: 'Aggregate from Twitter, GitHub, and Forums',
    feature2Title: 'AI Powered',
    feature2Desc: 'Sentiment analysis with Gemini 3',
    feature3Title: 'Smart Grouping',
    feature3Desc: 'Group similar feedback automatically',
  },

  // Grumble-specific
  grumble: {
    total: 'Total',
    positive: 'Positive',
    neutral: 'Neutral',
    negative: 'Negative',
    all: 'All',
    analyzing: 'Analyzing...',
    analyze: 'Analyze',
    noFeedbackYet: 'No feedback yet',
    clickSyncToFetch: 'Click Sync to fetch feedback from all sources',
    feedbackResults: 'Feedback Results',
    items: 'items',
    openOriginal: 'Open original',
    dismiss: 'Dismiss',
    syncAllSources: 'Sync All Sources',
    syncing: 'Syncing...',
    feedbackGroups: 'Feedback Groups',
    clear: 'Clear',
    howItWorks: 'How it works',
    howStep1: 'Configure keywords and repos above',
    howStep2: 'Click Sync to fetch feedback',
    howStep3: 'Use AI to analyze sentiment',
    keywords: 'Keywords',
    githubRepos: 'GitHub Repos',
    sources: 'Sources',
    twitter: 'Twitter',
    issues: 'Issues',
    discussions: 'Discussions',
    forum: 'Forum',
    translatedFrom: 'Translated from',
    languageNames: {
      en: 'English',
      pt: 'Portuguese',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      ja: 'Japanese',
      zh: 'Chinese',
    },
  },
};

export type LocaleStrings = typeof en;
