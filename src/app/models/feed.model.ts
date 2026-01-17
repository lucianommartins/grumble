/**
 * Feed source types supported by DevPulse
 */
export type FeedType = 'twitter' | 'rss' | 'blog' | 'youtube';

/**
 * Represents a content source (Twitter profile, RSS feed, blog, YouTube channel)
 */
export interface Feed {
  id: string;
  name: string;
  type: FeedType;
  url: string;  // @handle for Twitter, URL for RSS/blogs, channel ID for YouTube
  icon?: string;
  enabled: boolean;
  lastSync?: Date;
  createdAt: Date;
}

/**
 * Individual content item from any feed source
 */
export interface FeedItem {
  id: string;
  feedId: string;
  feedName: string;
  feedType: FeedType;
  title?: string;
  content: string;
  author: string;
  authorHandle?: string;
  publishedAt: Date;
  url: string;
  mediaUrls?: string[];
  selected: boolean;
  used?: boolean;  // true if item was used to generate a thread
  sourceFeeds?: { id: string; name: string; type: FeedType }[];  // for grouped duplicates
}

/**
 * Cached item with metadata for local storage
 */
export interface CachedItem {
  id: string;
  data: FeedItem;
  cachedAt: Date;
  expiresAt: Date;
}

/**
 * Generated Twitter thread
 */
export interface GeneratedThread {
  id: string;
  tweets: ThreadTweet[];
  generatedAt: Date;
  sourceItems: string[]; // IDs of source FeedItems
}

/**
 * Individual tweet in a thread
 */
export interface ThreadTweet {
  index: number;
  content: string;
  mediaPlaceholder?: MediaPlaceholder;
}

/**
 * Placeholder for image/video generation
 */
export interface MediaPlaceholder {
  type: 'image' | 'video';
  prompt: string;
  tool: 'veo3' | 'nanobanana';
}
