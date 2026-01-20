/**
 * Grumble Feedback Data Models
 * Models for feedback monitoring across Twitter, GitHub, and Discourse
 */

// Source types for Grumble
export type FeedbackSourceType = 'twitter-search' | 'github-issue' | 'github-discussion' | 'discourse';

// Sentiment analysis results
export type Sentiment = 'positive' | 'neutral' | 'negative';

// Feedback categories
export type FeedbackCategory =
  | 'bug-report'
  | 'feature-request'
  | 'performance-issue'
  | 'documentation-gap'
  | 'integration-problem'
  | 'breaking-change'
  | 'pricing-quota'
  | 'praise'
  | 'question'
  | 'other';

/**
 * Individual feedback item from any source
 */
export interface FeedbackItem {
  id: string;
  sourceType: FeedbackSourceType;
  sourceId: string;               // Original ID from source
  sourceName: string;             // Ex: "python-genai", "discuss.ai.google.dev", keyword

  title?: string;                 // For issues/discussions/forum posts
  content: string;                // Main text content
  author: string;
  authorHandle?: string;
  authorAvatar?: string;
  publishedAt: Date;
  url: string;

  // AI Analysis (populated after Gemini processing)
  sentiment?: Sentiment;
  sentimentConfidence?: number;   // 0-1 confidence score
  category?: FeedbackCategory;
  categoryConfidence?: number;
  groupId?: string;               // ID of similar feedback group

  // Source-specific metadata
  language?: string;              // Detected language (en, pt, es, etc.)
  replyCount?: number;
  reactionCount?: number;         // Likes, upvotes, +1s
  isReply?: boolean;              // Is this a reply/comment?
  parentId?: string;              // Parent item ID if reply

  // GitHub specific
  labels?: string[];
  state?: 'open' | 'closed';
  repo?: string;                  // e.g., "python-genai"

  // Translation (populated when content language differs from user's language)
  translatedContent?: string;     // Content translated to user's language
  translatedTitle?: string;       // Title translated to user's language

  // UI state
  selected: boolean;
  analyzed: boolean;
  dismissed: boolean;
}

/**
 * Group of similar feedback items
 */
export interface FeedbackGroup {
  id: string;
  theme: string;                  // AI-generated theme description
  summary: string;                // Brief summary of the feedback
  sentiment: Sentiment;
  category: FeedbackCategory;
  itemIds: string[];              // IDs of grouped feedback items
  itemCount: number;
  sources: { type: FeedbackSourceType; count: number }[];
  languages: string[];            // Languages present in this group
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cached feedback item with metadata
 */
export interface CachedFeedbackItem {
  id: string;
  data: FeedbackItem;
  cachedAt: Date;
  expiresAt: Date;
}

/**
 * Twitter search keyword configuration
 */
export interface SearchKeyword {
  id: string;
  term: string;                   // e.g., "gemini api"
  enabled: boolean;
  languages: string[] | 'all';    // Language filter
  createdAt: Date;
}

/**
 * GitHub repository configuration
 */
export interface GitHubRepoConfig {
  id: string;
  owner: string;                  // e.g., "googleapis"
  repo: string;                   // e.g., "python-genai"
  enabled: boolean;
  includeIssues: boolean;
  includeDiscussions: boolean;
  createdAt: Date;
}

/**
 * Discourse forum configuration
 */
export interface DiscourseConfig {
  id: string;
  baseUrl: string;                // e.g., "https://discuss.ai.google.dev"
  enabled: boolean;
  categories: string[] | 'all';   // Category slugs to monitor
  createdAt: Date;
}

/**
 * User settings for Grumble (extends base DevPulse settings)
 */
export interface GrumbleUserSettings {
  geminiApiKey?: string;
  twitterBearerToken?: string;
  githubPat?: string;             // GitHub Personal Access Token
  searchKeywords: SearchKeyword[];
  githubRepos: GitHubRepoConfig[];
  discourseConfigs: DiscourseConfig[];
}

/**
 * Default search keywords for Grumble
 * Multi-language support: EN, PT, ES, FR, DE, JA
 */
export const DEFAULT_KEYWORDS: Omit<SearchKeyword, 'id' | 'createdAt'>[] = [
  { term: 'gemini api', enabled: true, languages: ['en', 'pt-br', 'es', 'fr', 'de', 'ja'] },
  { term: 'ai studio', enabled: true, languages: ['en', 'pt-br', 'es', 'fr', 'de', 'ja'] },
  { term: 'gemini 3', enabled: true, languages: ['en', 'pt-br', 'es', 'fr', 'de', 'ja'] },
  { term: 'gemini api sdk', enabled: true, languages: ['en', 'pt-br', 'es', 'fr', 'de', 'ja'] },
];

/**
 * Default GitHub repositories to monitor
 */
export const DEFAULT_GITHUB_REPOS: Omit<GitHubRepoConfig, 'id' | 'createdAt'>[] = [
  { owner: 'googleapis', repo: 'python-genai', enabled: true, includeIssues: true, includeDiscussions: true },
  { owner: 'googleapis', repo: 'js-genai', enabled: true, includeIssues: true, includeDiscussions: true },
  { owner: 'googleapis', repo: 'go-genai', enabled: true, includeIssues: true, includeDiscussions: true },
  { owner: 'googleapis', repo: 'java-genai', enabled: true, includeIssues: true, includeDiscussions: true },
  { owner: 'googleapis', repo: 'dotnet-genai', enabled: true, includeIssues: true, includeDiscussions: true },
];

/**
 * Default Discourse configuration
 */
export const DEFAULT_DISCOURSE: Omit<DiscourseConfig, 'id' | 'createdAt'>[] = [
  { baseUrl: 'https://discuss.ai.google.dev', enabled: true, categories: 'all' },
];

/**
 * Sentiment badge colors for UI
 */
export const SENTIMENT_COLORS: Record<Sentiment, { bg: string; text: string; border: string }> = {
  positive: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' },
  neutral: { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', border: 'rgba(234, 179, 8, 0.3)' },
  negative: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
};

/**
 * Category display labels
 */
export const CATEGORY_LABELS: Record<FeedbackCategory, { icon: string; label: string }> = {
  'bug-report': { icon: '🐛', label: 'Bug Report' },
  'feature-request': { icon: '💡', label: 'Feature Request' },
  'performance-issue': { icon: '⚡', label: 'Performance' },
  'documentation-gap': { icon: '📚', label: 'Documentation' },
  'integration-problem': { icon: '🔌', label: 'Integration' },
  'breaking-change': { icon: '💥', label: 'Breaking Change' },
  'pricing-quota': { icon: '💰', label: 'Pricing/Quota' },
  'praise': { icon: '🎉', label: 'Praise' },
  'question': { icon: '❓', label: 'Question' },
  'other': { icon: '📝', label: 'Other' },
};
