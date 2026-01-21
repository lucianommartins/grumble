import { Injectable, inject, signal } from '@angular/core';
import { FeedbackItem, SearchKeyword, DEFAULT_KEYWORDS } from '../models/feedback.model';
import { UserSettingsService } from './user-settings.service';
import { LoggerService } from './logger.service';
import { I18nService } from '../i18n';

interface TwitterSearchResult {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
  lang?: string;
  entities?: {
    urls?: { expanded_url: string; display_url: string }[];
    mentions?: { username: string }[];
  };
  in_reply_to_user_id?: string;
  conversation_id?: string;
}

interface TwitterUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
}

interface TwitterSearchResponse {
  data?: TwitterSearchResult[];
  includes?: {
    users?: TwitterUser[];
  };
  meta?: {
    result_count: number;
    next_token?: string;
  };
  errors?: { message: string; title: string }[];
}

// Language codes supported by Twitter API that match our i18n
const TWITTER_LANG_MAP: Record<string, string> = {
  'en': 'en',
  'pt-br': 'pt',
  'pt-pt': 'pt',
  'es': 'es',
  'fr': 'fr',
  'de': 'de',
  'ja': 'ja',
  'zh': 'zh',
};

@Injectable({
  providedIn: 'root'
})
export class TwitterSearchService {
  private userSettings = inject(UserSettingsService);
  private logger = inject(LoggerService);
  private i18n = inject(I18nService);

  // Configuration
  keywords = signal<SearchKeyword[]>([]);

  constructor() {
    this.initializeDefaultKeywords();
  }

  private initializeDefaultKeywords(): void {
    const defaultConfigs: SearchKeyword[] = DEFAULT_KEYWORDS.map((kw, index) => ({
      ...kw,
      id: `keyword-${index}`,
      createdAt: new Date()
    }));
    this.keywords.set(defaultConfigs);
  }

  /**
   * Fetch with retry and exponential backoff
   */
  private async fetchWithRetry(url: string, options: RequestInit, context: string): Promise<Response> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`HTTP ${response.status} - ${JSON.stringify(errorData)}`);
        }
        return response;
      } catch (error: any) {
        lastError = error;
        const errorMsg = error?.message || String(error);
        const isRetryable = errorMsg.includes('503') || errorMsg.includes('429') ||
          errorMsg.includes('500') || errorMsg.includes('fetch');

        if (isRetryable && attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.warn(`[Twitter] ${context}: Retry ${attempt}/${maxRetries} in ${delay}ms (${errorMsg.substring(0, 60)}...)`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
    throw lastError;
  }

  /**
   * Search tweets using Twitter API v2 Recent Search (single language)
   * Requires Basic tier ($100/mo) or higher
   * @param since - Optional date to fetch only tweets newer than this
   */
  async searchTweets(
    query: string,
    language: string = 'en',
    maxResults: number = 50,
    since?: Date
  ): Promise<FeedbackItem[]> {
    const bearerToken = this.userSettings.getTwitterBearerToken();

    if (!bearerToken) {
      console.warn(`[Twitter] Bearer token not configured`);
      return [];
    }

    // Build query with single language filter
    const twitterLang = TWITTER_LANG_MAP[language] || language;
    let searchQuery = `(${query}) lang:${twitterLang} -is:retweet`;

    const params = new URLSearchParams({
      query: searchQuery,
      max_results: Math.min(maxResults, 100).toString(),
      'tweet.fields': 'created_at,public_metrics,lang,entities,in_reply_to_user_id,conversation_id',
      'user.fields': 'name,username,profile_image_url',
      expansions: 'author_id',
    });

    // Add start_time for incremental sync
    if (since) {
      params.set('start_time', since.toISOString());
    }

    try {
      const response = await this.fetchWithRetry(
        `/api/twitter/tweets/search/recent?${params}`,
        { headers: { 'X-Twitter-Bearer-Token': bearerToken } },
        `"${query}" (${language})`
      );

      const data: TwitterSearchResponse = await response.json();

      if (data.errors) {
        console.error(`[Twitter] "${query}" API errors:`, data.errors[0]?.message);
        return [];
      }

      const tweets = data.data || [];
      const users = new Map((data.includes?.users || []).map(u => [u.id, u]));

      console.log(`[Twitter] "${query}" (${language}): ${tweets.length} tweets`);

      return tweets.map(tweet => this.mapTweetToFeedback(tweet, users, query));
    } catch (error: any) {
      console.error(`[Twitter] "${query}" (${language}) FAILED: ${error?.message || error}`);
      return [];
    }
  }

  /**
   * Search all configured keywords across all languages
   * Searches each language separately for better coverage
   * @param since - Optional date to fetch only tweets newer than this
   */
  async searchAllKeywords(since?: Date): Promise<FeedbackItem[]> {
    const enabledKeywords = this.keywords().filter(k => k.enabled);
    const allItems: FeedbackItem[] = [];
    const seenIds = new Set<string>();

    if (since) {
      this.logger.info('TwitterSearch', `Incremental fetch: only tweets since ${since.toISOString()}`);
    }

    for (const keyword of enabledKeywords) {
      const languages = keyword.languages === 'all'
        ? Object.keys(TWITTER_LANG_MAP)
        : keyword.languages;

      // Search each language separately
      for (const lang of languages) {
        const tweets = await this.searchTweets(keyword.term, lang, 50, since);

        // Deduplicate across keywords and languages
        for (const tweet of tweets) {
          if (!seenIds.has(tweet.sourceId)) {
            seenIds.add(tweet.sourceId);
            allItems.push(tweet);
          }
        }

        // Small delay between searches to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    this.logger.info('TwitterSearch', `Total unique tweets across all languages: ${allItems.length}`);
    return allItems;
  }

  private mapTweetToFeedback(
    tweet: TwitterSearchResult,
    users: Map<string, TwitterUser>,
    keyword: string
  ): FeedbackItem {
    const author = users.get(tweet.author_id);

    return {
      id: `twitter-${tweet.id}`,
      sourceType: 'twitter-search',
      sourceId: tweet.id,
      sourceName: keyword,
      content: this.expandUrls(tweet.text, tweet.entities?.urls),
      author: author?.name || 'Unknown',
      authorHandle: author?.username,
      authorAvatar: author?.profile_image_url?.replace('_normal', '_bigger'),
      publishedAt: new Date(tweet.created_at),
      url: `https://twitter.com/${author?.username || 'i'}/status/${tweet.id}`,
      language: tweet.lang,
      replyCount: tweet.public_metrics?.reply_count || 0,
      reactionCount: (tweet.public_metrics?.like_count || 0) +
        (tweet.public_metrics?.retweet_count || 0) +
        (tweet.public_metrics?.quote_count || 0),
      isReply: !!tweet.in_reply_to_user_id,
      parentId: tweet.conversation_id !== tweet.id ? tweet.conversation_id : undefined,
      selected: false,
      analyzed: false,
      dismissed: false,
    };
  }

  /**
   * Expand t.co URLs to their full form
   */
  private expandUrls(
    text: string,
    urls?: { expanded_url: string; display_url: string }[]
  ): string {
    if (!urls) return text;

    let expanded = text;
    for (const url of urls) {
      // Replace t.co with display URL for readability
      expanded = expanded.replace(url.display_url, url.expanded_url);
    }
    return expanded;
  }

  /**
   * Add a new keyword to monitor
   */
  addKeyword(term: string): SearchKeyword {
    const keyword: SearchKeyword = {
      id: `keyword-${Date.now()}`,
      term: term.toLowerCase().trim(),
      enabled: true,
      languages: 'all',
      createdAt: new Date(),
    };
    this.keywords.update(keywords => [...keywords, keyword]);
    return keyword;
  }

  /**
   * Remove a keyword from monitoring
   */
  removeKeyword(id: string): void {
    this.keywords.update(keywords => keywords.filter(k => k.id !== id));
  }

  /**
   * Toggle keyword enabled state
   */
  toggleKeyword(id: string): void {
    this.keywords.update(keywords =>
      keywords.map(k => k.id === id ? { ...k, enabled: !k.enabled } : k)
    );
  }

  /**
   * Update keyword languages
   */
  updateKeywordLanguages(id: string, languages: string[] | 'all'): void {
    this.keywords.update(keywords =>
      keywords.map(k => k.id === id ? { ...k, languages } : k)
    );
  }
}
