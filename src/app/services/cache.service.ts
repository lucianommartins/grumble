import { Injectable, signal } from '@angular/core';
import { CachedItem, FeedItem } from '../models/feed.model';

const DB_NAME = 'devpulse-cache';
const DB_VERSION = 1;
const STORE_NAME = 'cached-items';

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  private db: IDBDatabase | null = null;
  private isReady = signal(false);

  constructor() {
    this.initDatabase();
  }

  private async initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        this.isReady.set(true);
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('feedId', 'data.feedId', { unique: false });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      };
    });
  }

  private async ensureReady(): Promise<void> {
    if (!this.db) {
      await this.initDatabase();
    }
  }

  /**
   * Check if an item exists in cache
   */
  async has(id: string): Promise<boolean> {
    await this.ensureReady();
    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => resolve(false);
    });
  }

  /**
   * Get cached item by ID
   */
  async get(id: string): Promise<FeedItem | null> {
    await this.ensureReady();
    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => {
        const cached = request.result as CachedItem | undefined;
        if (cached && new Date(cached.expiresAt) > new Date()) {
          resolve(cached.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  }

  /**
   * Store item in cache
   */
  async set(item: FeedItem, ttlHours: number = 168): Promise<void> {
    await this.ensureReady();
    const cachedItem: CachedItem = {
      id: item.id,
      data: item,
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000)
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(cachedItem);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete item from cache by ID
   */
  async delete(id: string): Promise<void> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all cached items for a specific feed
   */
  async getByFeed(feedId: string): Promise<FeedItem[]> {
    await this.ensureReady();
    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('feedId');
      const request = index.getAll(feedId);
      
      request.onsuccess = () => {
        const items = (request.result as CachedItem[])
          .filter(item => new Date(item.expiresAt) > new Date())
          .map(item => item.data);
        resolve(items);
      };
      request.onerror = () => resolve([]);
    });
  }

  /**
   * Get all cached items within a time window
   */
  async getRecent(hoursAgo: number = 48): Promise<FeedItem[]> {
    await this.ensureReady();
    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    
    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const items = (request.result as CachedItem[])
          .filter(item => 
            new Date(item.expiresAt) > new Date() &&
            new Date(item.data.publishedAt) >= cutoff
          )
          .map(item => item.data)
          .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        resolve(items);
      };
      request.onerror = () => resolve([]);
    });
  }

  /**
   * Clear expired items from cache
   */
  async clearExpired(): Promise<number> {
    await this.ensureReady();
    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      let deleted = 0;

      request.onsuccess = () => {
        const items = request.result as CachedItem[];
        const now = new Date();
        items.forEach(item => {
          if (new Date(item.expiresAt) <= now) {
            store.delete(item.id);
            deleted++;
          }
        });
        resolve(deleted);
      };
      request.onerror = () => resolve(0);
    });
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
