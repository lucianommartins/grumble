import { Injectable, inject, signal, computed } from '@angular/core';
import { Feed, FeedItem } from '../models/feed.model';
import { FeedService } from './feed.service';
import { TwitterService } from './twitter.service';
import { RssService } from './rss.service';
import { ScraperService } from './scraper.service';
import { YouTubeService } from './youtube.service';
import { CacheService } from './cache.service';
import { ItemStateService } from './item-state.service';

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private feedService = inject(FeedService);
  private twitterService = inject(TwitterService);
  private rssService = inject(RssService);
  private scraperService = inject(ScraperService);
  private youtubeService = inject(YouTubeService);
  private cacheService = inject(CacheService);
  private itemStateService = inject(ItemStateService);

  // State
  items = signal<FeedItem[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);
  timeWindowHours = signal(48);

  // Computed
  selectedItems = computed(() => this.items().filter(item => item.selected));
  selectedCount = computed(() => this.selectedItems().length);

  constructor() {
    // Auto-load cached items on startup
    this.loadFromCache();
  }

  /**
   * Load items from cache respecting current time window
   */
  private async loadFromCache(): Promise<void> {
    const hours = this.timeWindowHours();
    const cachedItems = await this.cacheService.getRecent(hours);

    if (cachedItems.length > 0) {
      // Deduplicate cached items
      let deduped = this.deduplicateItems(cachedItems);

      // Apply Firestore states (used/irrelevant) from cloud
      deduped = this.applyFirestoreStates(deduped);

      // Sort by date descending
      deduped.sort((a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
      this.items.set(deduped);
    }
  }

  /**
   * Apply Firestore states to items (used, irrelevant)
   */
  private applyFirestoreStates(items: FeedItem[]): FeedItem[] {
    return items.map(item => {
      const hash = this.itemStateService.generateItemHash(item.url, item.title, item.feedId);
      const state = this.itemStateService.getState(hash);

      if (state) {
        return {
          ...item,
          used: state.used || item.used,
          // If marked irrelevant in Firestore, treat as used
          selected: false
        };
      }
      return item;
    });
  }

  /**
   * Sync all enabled feeds
   */
  async syncAll(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    const enabledFeeds = this.feedService.getEnabledFeeds();
    const hours = this.timeWindowHours();

    try {
      const allItems: FeedItem[] = [];

      // Process feeds in parallel with Promise.allSettled for resilience
      const results = await Promise.allSettled(
        enabledFeeds.map(feed => this.fetchFeed(feed, hours))
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allItems.push(...result.value);
        } else {
          console.warn(`Failed to fetch feed ${enabledFeeds[index].name}:`, result.reason);
        }
      });

      // Deduplicate items by URL or title+author
      const deduped = this.deduplicateItems(allItems);

      // Sort by date descending
      deduped.sort((a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );

      this.items.set(deduped);

      // Update lastSync for all feeds
      enabledFeeds.forEach(feed => {
        this.feedService.updateFeed(feed.id, { lastSync: new Date() });
      });

    } catch (err) {
      this.error.set('Erro ao sincronizar feeds. Tente novamente.');
      console.error('Sync error:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async fetchFeed(feed: Feed, hours: number): Promise<FeedItem[]> {
    switch (feed.type) {
      case 'twitter':
        return this.twitterService.fetchTweets(feed, hours);
      case 'rss':
        return this.rssService.fetchFeed(feed, hours);
      case 'blog':
        return this.scraperService.scrapeBlog(feed, hours);
      case 'youtube':
        return this.youtubeService.fetchVideos(feed, hours);
      default:
        return [];
    }
  }

  /**
   * Toggle selection of an item
   */
  toggleSelection(itemId: string): void {
    this.items.update(items =>
      items.map(item =>
        item.id === itemId ? { ...item, selected: !item.selected } : item
      )
    );
  }

  /**
   * Select all items
   */
  selectAll(): void {
    this.items.update(items =>
      items.map(item => ({ ...item, selected: true }))
    );
  }

  /**
   * Deselect all items
   */
  deselectAll(): void {
    this.items.update(items =>
      items.map(item => ({ ...item, selected: false }))
    );
  }

  /**
   * Mark selected items as used (after thread generation)
   */
  markSelectedAsUsed(): void {
    const usedItems: FeedItem[] = [];
    const itemHashes: string[] = [];

    this.items.update(items =>
      items.map(item => {
        if (item.selected) {
          const updatedItem = { ...item, used: true, selected: false };
          usedItems.push(updatedItem);
          // Generate hash for Firestore sync
          const hash = this.itemStateService.generateItemHash(item.url, item.title, item.feedId);
          itemHashes.push(hash);
          return updatedItem;
        }
        return item;
      })
    );

    // Persist used state to local cache
    usedItems.forEach(item => {
      this.cacheService.set(item);
    });

    // Sync to Firestore (async, fire-and-forget)
    if (itemHashes.length > 0) {
      this.itemStateService.markMultipleAsUsed(itemHashes).catch(err => {
        console.warn('[SyncService] Failed to sync used states to Firestore:', err);
      });
    }
  }

  /**
   * Mark a single item as irrelevant (used=true, won't appear as available)
   */
  markAsIrrelevant(itemId: string): void {
    let itemToUpdate: FeedItem | null = null;
    let itemHash: string | null = null;

    this.items.update(items =>
      items.map(item => {
        if (item.id === itemId) {
          itemToUpdate = { ...item, used: true, selected: false };
          itemHash = this.itemStateService.generateItemHash(item.url, item.title, item.feedId);
          return itemToUpdate;
        }
        return item;
      })
    );

    // Persist to local cache
    if (itemToUpdate) {
      this.cacheService.set(itemToUpdate);
    }

    // Sync to Firestore
    if (itemHash) {
      this.itemStateService.markAsIrrelevant(itemHash).catch(err => {
        console.warn('[SyncService] Failed to sync irrelevant state to Firestore:', err);
      });
    }
  }

  /**
   * Delete multiple items from cache
   */
  async deleteItems(itemIds: string[]): Promise<void> {
    // Remove from local state
    this.items.update(items => items.filter(item => !itemIds.includes(item.id)));

    // Remove from cache
    for (const itemId of itemIds) {
      await this.cacheService.delete(itemId);
    }

    console.log(`[SyncService] Deleted ${itemIds.length} items from cache`);
  }

  /**
   * Set time window and refresh
   */
  setTimeWindow(hours: number): void {
    this.timeWindowHours.set(hours);
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    await this.cacheService.clearAll();
    this.items.set([]);
  }

  /**
   * Deduplicate items by URL or title, merging source feeds
   */
  private deduplicateItems(items: FeedItem[]): FeedItem[] {
    const seen = new Map<string, FeedItem>();

    for (const item of items) {
      // Create a key based on title (preferred for cross-feed matching), URL, or content hash
      // For Twitter, content is more reliable than URL
      let key: string;
      if (item.title) {
        // Normalize title for comparison (lowercase, remove extra spaces)
        key = item.title.toLowerCase().trim().replace(/\s+/g, ' ');
      } else if (item.feedType === 'twitter') {
        // For Twitter, use content hash since titles may not exist
        key = item.content.substring(0, 100).toLowerCase().trim();
      } else {
        key = item.url || item.content.substring(0, 100);
      }

      if (seen.has(key)) {
        // Merge source feeds
        const existing = seen.get(key)!;
        const sourceFeeds = existing.sourceFeeds || [
          { id: existing.feedId, name: existing.feedName, type: existing.feedType }
        ];

        // Add this feed if not already present
        if (!sourceFeeds.some(sf => sf.id === item.feedId)) {
          sourceFeeds.push({ id: item.feedId, name: item.feedName, type: item.feedType });
        }

        existing.sourceFeeds = sourceFeeds;
      } else {
        // First occurrence - initialize sourceFeeds
        item.sourceFeeds = [{ id: item.feedId, name: item.feedName, type: item.feedType }];
        seen.set(key, item);
      }
    }

    return Array.from(seen.values());
  }
}
