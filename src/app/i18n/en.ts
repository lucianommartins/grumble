// DevPulse Localization - English (en)
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
    image: 'Image',
    video: 'Video',
    originalMedia: 'Original Media',
    aiGenerated: 'AI Generated',
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
    description: 'Configure your API keys to use DevPulse. Keys are stored securely and associated with your account.',
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

  // Sidebar
  sidebar: {
    timeWindow: 'TIME WINDOW',
    sources: 'SOURCES',
    addSource: 'Add source',
    editSource: 'Edit Source',
    newSource: 'New Source',
    noSources: 'No sources added.',
    noSourcesHint: 'Click + to add one.',
    enableAll: 'Enable all',
    syncSources: 'Sync Sources',
    syncing: 'Syncing...',
    feedNamePlaceholder: 'Feed name',
    feedUrlPlaceholder: '@handle or URL',
    typeTwitter: 'Twitter/X',
    typeRss: 'RSS Feed',
    typeBlog: 'Blog (scraping)',
    typeYoutube: 'YouTube',
    autoDetected: 'Auto-detected',
    howItWorks: 'How it works',
    howStep1: 'Syncs real data from sources',
    howStep2: 'Select interesting updates',
    howStep3: 'Generates an engagement-optimized thread',
    showOnlyThis: 'Show only this source',
    editSource2: 'Edit source',
    removeSource: 'Remove source',
  },

  // Feed Dashboard
  feed: {
    loadedItems: 'items loaded',
    markIrrelevant: 'Mark as irrelevant',
    noItems: 'No items yet',
    noItemsHint: 'Sync your sources to see content here.',
    selectToGenerate: 'Select items and click Generate Thread',
    hideUsedItems: 'Hide used items',
    minutesAgo: 'min ago',
    hoursAgo: 'h ago',
    daysAgo: 'd ago',
    justNow: 'now',
    alsoIn: 'Also in:',
    confirmDelete: 'Delete {count} selected items from cache?',
  },

  // Content Panel (formerly Thread Panel)
  content: {
    title: 'Content Generator',
    noContent: 'No content generated yet',
    selectItems: 'Select items from the feed and click Generate',
    generateContent: 'Generate Content',
    selectPlatforms: 'Select platforms',
    generating: 'Generating...',
    generatingOptimized: 'Generating optimized content...',
    generatingHint: 'Analyzing content and creating optimized posts',
    regenerate: 'Regenerate',
    copyToClipboard: 'Copy to clipboard',
    copied: 'Copied!',
    post: 'Post',
    tweet: 'Tweet',
    addMedia: 'Add media',
    generatingImage: 'Generating image...',
    generatingVideo: 'Generating video...',
    generatingVideoMinutes: 'Generating video (may take a few minutes)...',
    generatingVideoProgress: 'Generating video...',
    videoSuccess: 'Video generated successfully!',
    startingVideo: 'Starting video generation...',
    urlContext: 'Additional URLs for context',
    urlPlaceholder: 'Paste URLs here, one per line',
    urlHint: 'Additional URLs will be used as context to enrich the content',
    regenerateMedia: 'Regenerate media',
    generate: 'Generate',
    comment: 'Comment',
    referenceLink: 'Reference link',
  },

  // Platforms
  platforms: {
    twitter: 'Twitter',
    linkedin: 'LinkedIn',
    threads: 'Threads',
    bluesky: 'BlueSky',
    selectAtLeastOne: 'Select at least one platform',
  },

  // Media
  media: {
    generatingImage: 'Generating image...',
    generatingVideo: 'Generating video...',
    tabTitle: 'Media',
    assetsTitle: 'Media Assets',
    noAssets: 'No media assets to generate',
    generateAll: 'Generate All',
    downloadAll: 'Download All',
    linkedinHint: 'LinkedIn accepts only 1 media. Choose between image or video.',
    imageFor: 'Image for',
    videoFor: 'Video for',
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
  },

  // Login
  login: {
    welcome: 'Welcome to',
    appName: 'DevPulse',
    tagline: 'Transform your content into engaging Twitter threads',
    feature1Title: 'Multi-source',
    feature1Desc: 'Aggregate from Twitter, RSS, and blogs',
    feature2Title: 'AI Powered',
    feature2Desc: 'Generate threads with Gemini 3',
    feature3Title: 'Visual Media',
    feature3Desc: 'Create images and videos with AI',
  },
};

export type LocaleStrings = typeof en;
