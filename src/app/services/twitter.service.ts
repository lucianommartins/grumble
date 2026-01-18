import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Feed, FeedItem } from '../models/feed.model';
import { CacheService } from './cache.service';
import { UserSettingsService } from './user-settings.service';
import { RetryService } from './retry.service';
import { LoggerService } from './logger.service';

interface TwitterUser {
  id: string;
  name: string;
  username: string;
}

interface TwitterTweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  attachments?: {
    media_keys?: string[];
  };
  entities?: {
    urls?: Array<{
      url: string;
      expanded_url: string;
      display_url: string;
      title?: string;
      unwound_url?: string;
      description?: string;
    }>;
  };
  note_tweet?: {
    text: string;
    entities?: {
      urls?: Array<{
        url: string;
        expanded_url: string;
        title?: string;
        description?: string;
      }>;
    };
  };
}

interface TwitterMediaVariant {
  bit_rate?: number;
  content_type: string;
  url: string;
}

interface TwitterMedia {
  media_key: string;
  type: string;
  url?: string;
  preview_image_url?: string;
  variants?: TwitterMediaVariant[];
}

interface TwitterResponse {
  data?: TwitterTweet[];
  includes?: {
    users?: TwitterUser[];
    media?: TwitterMedia[];
  };
  meta?: {
    result_count: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class TwitterService {
  private http = inject(HttpClient);
  private cache = inject(CacheService);
  private userSettings = inject(UserSettingsService);
  private retryService = inject(RetryService);
  private logger = inject(LoggerService);

  // Use proxy server to avoid CORS issues
  private readonly API_BASE = '/api/twitter';

  private getHeaders(): HttpHeaders {
    const bearerToken = this.userSettings.getTwitterBearerToken();
    if (!bearerToken) {
      throw new Error('Twitter Bearer Token não configurado. Configure em ⚙️ Configurações.');
    }
    return new HttpHeaders({ 'X-Twitter-Bearer-Token': bearerToken });
  }

  /**
   * Fetch tweets from a user within the time window
   */
  async fetchTweets(feed: Feed, hoursAgo: number = 48): Promise<FeedItem[]> {
    // Extract username from URL or handle
    let username = feed.url.replace('@', '').trim();

    // Handle full URLs like https://twitter.com/username or https://x.com/username
    const urlMatch = username.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/i);
    if (urlMatch) {
      username = urlMatch[1];
    }

    try {
      // Calculate start time for the query
      const startTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

      // First, get user ID
      const userId = await this.getUserId(username);
      if (!userId) {
        this.logger.warn('Twitter', `Could not find Twitter user: ${username}`);
        return [];
      }

      // Fetch tweets from cache first
      const cachedItems = await this.getCachedTweets(feed.id, startTime);
      const cachedIds = new Set(cachedItems.map(item => item.id));

      // Fetch new tweets from API
      const newTweets = await this.fetchUserTweets(userId, username, feed, startTime);

      // Filter out already cached tweets
      const uncachedTweets = newTweets.filter(tweet => !cachedIds.has(tweet.id));

      // Cache new tweets
      for (const tweet of uncachedTweets) {
        await this.cache.set(tweet);
      }

      // Combine and return all tweets
      return [...uncachedTweets, ...cachedItems]
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    } catch (error) {
      this.logger.error('Twitter', `Error fetching tweets for ${username}:`, error);
      // Return cached items on error
      const startTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
      return this.getCachedTweets(feed.id, startTime);
    }
  }

  private async getUserId(username: string): Promise<string | null> {
    try {
      const response = await this.http.get<{ data?: { id: string } }>(
        `${this.API_BASE}/users/by/username/${username}`,
        { headers: this.getHeaders() }
      ).toPromise();
      return response?.data?.id || null;
    } catch {
      return null;
    }
  }

  private async fetchUserTweets(
    userId: string,
    username: string,
    feed: Feed,
    startTime: Date
  ): Promise<FeedItem[]> {
    const params = new URLSearchParams({
      'tweet.fields': 'created_at,author_id,attachments,entities,note_tweet',
      'expansions': 'author_id,attachments.media_keys',
      'media.fields': 'url,preview_image_url,type,variants',
      'user.fields': 'name,username',
      'start_time': startTime.toISOString(),
      'max_results': '100',
      'exclude': 'replies,retweets'  // Only original posts
    });

    try {
      const response = await this.http.get<TwitterResponse>(
        `${this.API_BASE}/users/${userId}/tweets?${params.toString()}`,
        { headers: this.getHeaders() }
      ).toPromise();

      if (!response?.data) {
        return [];
      }

      const users = new Map<string, TwitterUser>();
      response.includes?.users?.forEach(user => users.set(user.id, user));

      const media = new Map<string, TwitterMedia>();
      response.includes?.media?.forEach(m => media.set(m.media_key, m));

      const items: FeedItem[] = response.data.map(tweet => {
        const author = users.get(tweet.author_id);
        const mediaUrls = tweet.attachments?.media_keys
          ?.flatMap(key => {
            const m = media.get(key);
            if (!m) return [];

            // For videos, add thumbnail first (for display), then MP4 (for playback)
            if (m.type === 'video' && m.variants) {
              const urls: string[] = [];
              // Add thumbnail first for display in feed
              if (m.preview_image_url) {
                urls.push(m.preview_image_url);
              }
              // Add MP4 for playback
              const mp4Variants = m.variants
                .filter(v => v.content_type === 'video/mp4')
                .sort((a, b) => (b.bit_rate || 0) - (a.bit_rate || 0));
              if (mp4Variants.length > 0) {
                urls.push(mp4Variants[0].url.replace('video.twimg.com', 'pbs.twimg.com'));
              }
              return urls;
            }

            // For images
            return m.url ? [m.url] : [];
          }) || [];

        // For long tweets/articles, use note_tweet.text; otherwise use regular text
        let rawText = tweet.note_tweet?.text || tweet.text;

        // Get URL entities from note_tweet if available, otherwise from regular entities
        const urlEntities = tweet.note_tweet?.entities?.urls || tweet.entities?.urls || [];

        // Expand t.co URLs with title > description > expanded_url
        let expandedText = rawText;
        for (const urlEntity of urlEntities) {
          let replacement = urlEntity.title || urlEntity.description || urlEntity.expanded_url;

          // If it's an article URL with no title (API returns status 500), show emoji indicator
          if (replacement.match(/x\.com\/i\/article\/|twitter\.com\/i\/article\//)) {
            replacement = '📄 Twitter Article';
          }

          expandedText = expandedText.replace(urlEntity.url, replacement);
        }

        return {
          id: `twitter_${tweet.id}`,
          feedId: feed.id,
          feedName: feed.name,
          feedType: 'twitter' as const,
          content: expandedText,
          author: author?.name || username,
          authorHandle: `@${author?.username || username}`,
          publishedAt: new Date(tweet.created_at),
          url: `https://twitter.com/${username}/status/${tweet.id}`,
          mediaUrls,
          selected: false
        };
      });

      return items;
    } catch (error) {
      console.error('Error fetching tweets:', error);
      return [];
    }
  }

  private async getCachedTweets(feedId: string, since: Date): Promise<FeedItem[]> {
    const cached = await this.cache.getByFeed(feedId);
    return cached.filter(item => new Date(item.publishedAt) >= since);
  }
}
