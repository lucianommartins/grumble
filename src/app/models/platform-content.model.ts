/**
 * Platform types supported for content generation
 */
export type Platform = 'twitter' | 'linkedin' | 'threads' | 'bluesky';

/**
 * Platform metadata for UI display
 */
export interface PlatformInfo {
  id: Platform;
  name: string;
  icon: string;
  maxChars: number;
  supportsThreads: boolean;
}

/**
 * Platform configurations with their constraints
 */
export const PLATFORMS: Record<Platform, PlatformInfo> = {
  twitter: {
    id: 'twitter',
    name: 'Twitter',
    icon: '🐦',
    maxChars: 280,
    supportsThreads: true
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '💼',
    maxChars: 3000,
    supportsThreads: false
  },
  threads: {
    id: 'threads',
    name: 'Threads',
    icon: '🧵',
    maxChars: 500,
    supportsThreads: true
  },
  bluesky: {
    id: 'bluesky',
    name: 'BlueSky',
    icon: '🦋',
    maxChars: 300,
    supportsThreads: true
  }
};

/**
 * A single post within a platform's content
 */
export interface PlatformPost {
  text: string;
  mediaPlaceholder?: string;  // [IMAGE] or [VIDEO]
  isComment?: boolean;        // For LinkedIn comment with link
  linkReference?: string;     // Reference link for LinkedIn comment
}

/**
 * Content generated for a specific platform
 */
export interface PlatformContent {
  platform: Platform;
  posts: PlatformPost[];
  isGenerating?: boolean;
  error?: string;
}

/**
 * Complete generated content across all selected platforms
 */
export interface GeneratedContent {
  twitter?: PlatformContent;
  linkedin?: PlatformContent;
  threads?: PlatformContent;
  bluesky?: PlatformContent;
}

/**
 * Selection state for platforms
 */
export interface PlatformSelection {
  twitter: boolean;
  linkedin: boolean;
  threads: boolean;
  bluesky: boolean;
}

/**
 * Default platform selection (Twitter enabled by default)
 */
export const DEFAULT_PLATFORM_SELECTION: PlatformSelection = {
  twitter: true,
  linkedin: false,
  threads: false,
  bluesky: false
};
