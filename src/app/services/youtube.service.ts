import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Feed, FeedItem } from '../models/feed.model';
import { CacheService } from './cache.service';

interface YouTubeRSSItem {
  id: string;
  title: string;
  published: string;
  updated: string;
  link: string;
  author: string;
  description: string;
  thumbnail?: string;
}

@Injectable({
  providedIn: 'root'
})
export class YouTubeService {
  private http = inject(HttpClient);
  private cache = inject(CacheService);

  /**
   * Fetch videos from a YouTube channel via RSS
   */
  async fetchVideos(feed: Feed, hoursAgo: number = 168): Promise<FeedItem[]> {
    // Extract channel ID - could be full URL or just the ID
    const channelId = this.extractChannelId(feed.url);

    if (!channelId) {
      console.warn(`Invalid YouTube channel ID: ${feed.url}`);
      return [];
    }

    const startTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

    try {
      // Fetch cached items first
      const cachedItems = await this.getCachedVideos(feed.id, startTime);
      const cachedIds = new Set(cachedItems.map(item => item.id));

      // Fetch RSS feed via CORS proxy
      const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(feedUrl)}`;
      const response = await this.http.get(proxyUrl, { responseType: 'text' }).toPromise();

      if (!response) {
        return cachedItems;
      }

      // Parse XML
      const parser = new DOMParser();
      const doc = parser.parseFromString(response, 'text/xml');
      const entries = doc.querySelectorAll('entry');

      console.log(`[YouTube] Found ${entries.length} entries in RSS feed for ${feed.name}`);

      const items: FeedItem[] = [];

      entries.forEach((entry, idx) => {
        // Extract video ID using multiple methods
        let videoId = '';
        const idElement = entry.querySelector('id');
        if (idElement?.textContent) {
          // Format: yt:video:VIDEO_ID
          const match = idElement.textContent.match(/video:([^:]+)$/);
          if (match) videoId = match[1];
        }

        if (!videoId) {
          console.warn(`[YouTube] Could not extract video ID from entry ${idx}`);
          return;
        }

        const id = `youtube_${videoId}`;

        // Skip if already cached
        if (cachedIds.has(id)) return;

        const publishedEl = entry.querySelector('published');
        const published = new Date(publishedEl?.textContent || '');

        console.log(`[YouTube] Video ${videoId} published: ${published.toISOString()}, startTime: ${startTime.toISOString()}`);

        // Skip if outside time window
        if (published < startTime) {
          console.log(`[YouTube] Skipping video ${videoId} - outside time window`);
          return;
        }

        const title = entry.querySelector('title')?.textContent || '';
        const authorEl = entry.querySelector('author name');
        const author = authorEl?.textContent || feed.name;
        const linkEl = entry.querySelector('link');
        const link = linkEl?.getAttribute('href') || '';

        // Get thumbnail - try to find media:thumbnail or construct from video ID
        const thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

        // Get description - try media:description
        const mediaGroup = entry.getElementsByTagName('media:group')[0];
        const description = mediaGroup?.getElementsByTagName('media:description')[0]?.textContent || '';

        const item: FeedItem = {
          id,
          feedId: feed.id,
          feedName: feed.name,
          feedType: 'youtube',
          title,
          content: description || title,
          author,
          publishedAt: published,
          url: link || `https://www.youtube.com/watch?v=${videoId}`,
          mediaUrls: thumbnail ? [thumbnail] : [],
          selected: false
        };

        console.log(`[YouTube] Added video: ${title}`);
        items.push(item);
      });

      // Cache new items
      for (const item of items) {
        await this.cache.set(item);
      }

      // Combine and return
      return [...items, ...cachedItems]
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    } catch (error) {
      console.error(`Error fetching YouTube videos for ${feed.name}:`, error);
      return this.getCachedVideos(feed.id, startTime);
    }
  }

  /**
   * Extract channel ID from URL or raw ID
   */
  private extractChannelId(input: string): string | null {
    const trimmed = input.trim();

    // Already a channel ID (starts with UC and is 24 chars)
    if (/^UC[a-zA-Z0-9_-]{22}$/.test(trimmed)) {
      return trimmed;
    }

    // URL format: youtube.com/channel/UCXXXXX
    const channelMatch = trimmed.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);
    if (channelMatch) {
      return channelMatch[1];
    }

    // If it looks like a channel ID even if not perfect format
    if (trimmed.startsWith('UC') && trimmed.length >= 20) {
      return trimmed;
    }

    return null;
  }

  private async getCachedVideos(feedId: string, since: Date): Promise<FeedItem[]> {
    const cached = await this.cache.getByFeed(feedId);
    return cached.filter(item => new Date(item.publishedAt) >= since);
  }
}
