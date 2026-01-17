import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Feed, FeedItem } from '../models/feed.model';
import { CacheService } from './cache.service';

interface RSSItem {
  title?: string;
  description?: string;
  content?: string;
  link?: string;
  pubDate?: string;
  published?: string;
  author?: string;
  creator?: string;
  enclosure?: {
    url?: string;
    type?: string;
  };
  mediaUrls?: string[];
}

interface ParsedFeed {
  items: RSSItem[];
  title?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RssService {
  private http = inject(HttpClient);
  private cache = inject(CacheService);

  // Use a CORS proxy for RSS feeds
  private readonly CORS_PROXY = 'https://corsproxy.io/?';

  /**
   * Fetch RSS/Atom feed items within the time window
   */
  async fetchFeed(feed: Feed, hoursAgo: number = 48): Promise<FeedItem[]> {
    try {
      const startTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

      // Fetch cached items first
      const cachedItems = await this.getCachedItems(feed.id, startTime);
      const cachedIds = new Set(cachedItems.map(item => item.id));

      // Fetch feed from URL
      const feedUrl = encodeURIComponent(feed.url);
      const response = await this.http.get(
        `${this.CORS_PROXY}${feedUrl}`,
        { responseType: 'text' }
      ).toPromise();

      if (!response) {
        return cachedItems;
      }

      // Parse the feed
      const parsed = this.parseFeed(response);
      const items = this.convertToFeedItems(parsed, feed, startTime);

      // Filter out already cached items
      const newItems = items.filter(item => !cachedIds.has(item.id));

      // For items without images, try to fetch from article page (in parallel, limited)
      const itemsNeedingImages = newItems.filter(item => !item.mediaUrls || item.mediaUrls.length === 0);
      if (itemsNeedingImages.length > 0) {
        // Fetch images in parallel (max 3 at a time to avoid overwhelming)
        const chunks = this.chunkArray(itemsNeedingImages, 3);
        for (const chunk of chunks) {
          await Promise.all(chunk.map(item => this.fetchArticleImages(item)));
        }
      }

      // Cache new items
      for (const item of newItems) {
        await this.cache.set(item);
      }

      // Return all items sorted by date
      return [...newItems, ...cachedItems]
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    } catch (error) {
      console.error(`Error fetching RSS feed ${feed.name}:`, error);
      const startTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
      return this.getCachedItems(feed.id, startTime);
    }
  }

  private parseFeed(xml: string): ParsedFeed {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    // Try RSS format first
    let items = Array.from(doc.querySelectorAll('item'));

    // Try Atom format if no RSS items found
    if (items.length === 0) {
      items = Array.from(doc.querySelectorAll('entry'));
    }

    const feedTitle = doc.querySelector('channel > title, feed > title')?.textContent || '';

    return {
      title: feedTitle,
      items: items.map(item => this.parseItem(item))
    };
  }

  private parseItem(item: Element): RSSItem {
    const getContent = (selectors: string[]): string => {
      for (const selector of selectors) {
        const el = item.querySelector(selector);
        if (el?.textContent) {
          return el.textContent.trim();
        }
      }
      return '';
    };

    const getLink = (): string => {
      // RSS format
      const rssLink = item.querySelector('link')?.textContent?.trim();
      if (rssLink) return rssLink;

      // Atom format
      const atomLink = item.querySelector('link[href]')?.getAttribute('href');
      if (atomLink) return atomLink;

      return '';
    };

    const getMediaUrls = (): string[] => {
      const urls: string[] = [];
      const seen = new Set<string>();

      const addUrl = (url: string | undefined | null) => {
        if (!url || seen.has(url)) return;
        // Skip small avatars/icons
        if (url.includes('avatar') || url.includes('icon')) return;
        if (url.includes('1x1') || url.includes('placeholder')) return;
        // Skip Medium small resizes (avatars)
        if (url.includes('resize:fill:') && /fill:\d+:\d+/.test(url)) {
          const match = url.match(/fill:(\d+):(\d+)/);
          if (match && parseInt(match[1]) < 100) return;
        }
        seen.add(url);
        urls.push(url);
      };

    // Enclosure (standard RSS)
      const enclosure = item.querySelector('enclosure[url]');
      if (enclosure) {
        const type = enclosure.getAttribute('type') || '';
        if (type.startsWith('image/')) {
          addUrl(enclosure.getAttribute('url'));
        }
      }

      // media:content
      const mediaContent = item.querySelector('media\\:content[url], content[url]');
      if (mediaContent) {
        addUrl(mediaContent.getAttribute('url'));
      }

      // Extract ALL images from content using regex
      const content = getContent(['content\\:encoded', 'content', 'description']);

      // Standard img tags
      const imgMatches = content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
      for (const match of imgMatches) {
        addUrl(match[1]);
      }

      // Medium CDN pattern (miro.medium.com)
      const mediumMatches = content.matchAll(/https:\/\/miro\.medium\.com\/[^"'\s<>]+/gi);
      for (const match of mediumMatches) {
        addUrl(match[0]);
      }

      // Figure with data-* attributes (lazy loading)
      const figureMatches = content.matchAll(/data-src=["']([^"']+)["']/gi);
      for (const match of figureMatches) {
        addUrl(match[1]);
      }

      return urls;
    };

    return {
      title: getContent(['title']),
      description: getContent(['description', 'summary']),
      content: getContent(['content\\:encoded', 'content']),
      link: getLink(),
      pubDate: getContent(['pubDate', 'published', 'updated', 'dc\\:date']),
      author: getContent(['author', 'dc\\:creator', 'creator']),
      mediaUrls: getMediaUrls()
    };
  }

  private convertToFeedItems(parsed: ParsedFeed, feed: Feed, since: Date): FeedItem[] {
    return parsed.items
      .map(item => {
        const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();

        // Skip items older than the time window
        if (pubDate < since) {
          return null;
        }

        const content = item.content || item.description || '';
        // Strip HTML tags for display
        const cleanContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

        return {
          id: `rss_${this.hashString(item.link || item.title || '')}`,
          feedId: feed.id,
          feedName: feed.name,
          feedType: feed.type,
          title: item.title,
          content: cleanContent.substring(0, 500) + (cleanContent.length > 500 ? '...' : ''),
          author: item.author || feed.name,
          publishedAt: pubDate,
          url: item.link || '',
          mediaUrls: item.mediaUrls && item.mediaUrls.length > 0 ? item.mediaUrls : undefined,
          selected: false
        } as FeedItem;
      })
      .filter((item): item is FeedItem => item !== null);
  }

  private async getCachedItems(feedId: string, since: Date): Promise<FeedItem[]> {
    const cached = await this.cache.getByFeed(feedId);
    return cached.filter(item => new Date(item.publishedAt) >= since);
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async fetchArticleImages(item: FeedItem): Promise<void> {
    if (!item.url) return;

    try {
      const pageUrl = encodeURIComponent(item.url);
      const html = await this.http.get(
        `${this.CORS_PROXY}${pageUrl}`,
        { responseType: 'text' }
      ).toPromise();

      if (!html) return;

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const images: string[] = [];
      const seen = new Set<string>();
      const seenMediumIds = new Set<string>();

      // Extract Medium image unique ID (e.g., "1*K7BmzAA_q1xg8v0pHdpsYg" from the URL)
      const getMediumImageId = (url: string): string | null => {
        const match = url.match(/\/([01]\*[A-Za-z0-9_-]+)\./);
        return match ? match[1] : null;
      };

      const addImage = (url: string | null | undefined) => {
        if (!url) return;

        // Skip logos and branding
        if (url.includes('avatar') || url.includes('icon') || url.includes('logo')) return;
        if (url.includes('1x1') || url.includes('placeholder')) return;
        if (url.includes('miro.medium.com/v2/da:true')) return; // Medium letter logo
        if (url.includes('lettermark') || url.includes('wordmark')) return;

        // Skip Medium small resizes (avatars, thumbnails)
        if (url.includes('resize:fill:') && /fill:\d+:\d+/.test(url)) {
          const match = url.match(/fill:(\d+):(\d+)/);
          if (match && parseInt(match[1]) < 100) return;
        }

        // Deduplicate by exact URL
        if (seen.has(url)) return;

        // For Medium images, dedupe by unique image ID (same image, different sizes)
        const mediumId = getMediumImageId(url);
        if (mediumId) {
          if (seenMediumIds.has(mediumId)) return;
          seenMediumIds.add(mediumId);
        }

        seen.add(url);
        images.push(url);
      };

      // Try og:image first
      const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
      addImage(ogImage);

      // Get images from article content
      const articleImgs = doc.querySelectorAll('article img, main img, figure img');
      for (const img of Array.from(articleImgs)) {
        addImage(img.getAttribute('src') || img.getAttribute('data-src'));
      }

      // Medium-specific: extract from raw HTML (only if we don't have enough images)
      if (item.url.includes('medium.com') && images.length < 3) {
        const mediumMatches = html.matchAll(/https:\/\/miro\.medium\.com\/v2\/resize:[^"'\s<>]+/gi);
        for (const match of mediumMatches) {
          addImage(match[0]);
        }
      }

      if (images.length > 0) {
        item.mediaUrls = images;
      }
    } catch (error) {
      console.warn(`[RssService] Failed to fetch images for ${item.url}:`, error);
    }
  }
}
