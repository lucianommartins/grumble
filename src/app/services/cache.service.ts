import { Injectable, inject, signal, effect } from '@angular/core';
import { Firestore, doc, setDoc, getDocs, deleteDoc, collection, Timestamp, writeBatch, query, where } from '@angular/fire/firestore';
import { CachedItem, FeedItem } from '../models/feed.model';
import { AuthService } from './auth.service';
import { LoggerService } from './logger.service';

const DB_NAME = 'devpulse-cache';
const DB_VERSION = 1;
const STORE_NAME = 'cached-items';
const FIRESTORE_COLLECTION = 'cachedItems';

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private logger = inject(LoggerService);

  private db: IDBDatabase | null = null;
  private isReady = signal(false);
  private currentUserId: string | null = null;
  private firestoreSyncPending: CachedItem[] = [];
  private firestoreSyncInProgress = false;

  constructor() {
    this.initDatabase();

    // Sync with Firestore when user logs in
    effect(() => {
      const user = this.authService.currentUser();
      if (user && user.uid !== this.currentUserId) {
        this.currentUserId = user.uid;
        this.logger.info('CacheService', `User logged in: ${user.uid}, syncing from Firestore...`);
        // Sync from Firestore to IndexedDB on new device
        setTimeout(() => this.syncFromFirestore(), 500);
      } else if (!user) {
        this.currentUserId = null;
      }
    });
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
   * Sync cached items FROM Firestore TO IndexedDB (for new devices)
   */
  private async syncFromFirestore(): Promise<void> {
    if (!this.currentUserId) return;

    try {
      const collectionRef = collection(
        this.firestore,
        `users/${this.currentUserId}/${FIRESTORE_COLLECTION}`
      );

      const snapshot = await getDocs(collectionRef);
      const firestoreItems: CachedItem[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data) {
          firestoreItems.push({
            id: docSnap.id,
            data: data['data'] as FeedItem,
            cachedAt: data['cachedAt']?.toDate?.() || new Date(data['cachedAt']),
            expiresAt: data['expiresAt']?.toDate?.() || new Date(data['expiresAt'])
          });
        }
      });

      if (firestoreItems.length > 0) {
        await this.ensureReady();
        const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        let addedCount = 0;
        for (const item of firestoreItems) {
          // Only add if not expired
          if (new Date(item.expiresAt) > new Date()) {
            // Check if already exists
            const existing = await this.checkExists(store, item.id);
            if (!existing) {
              store.put(item);
              addedCount++;
            }
          }
        }

        this.logger.info('CacheService', `Synced ${addedCount} items from Firestore`);
      }
    } catch (error) {
      this.logger.error('CacheService', 'Failed to sync from Firestore:', error);
    }
  }

  private checkExists(store: IDBObjectStore, id: string): Promise<boolean> {
    return new Promise((resolve) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => resolve(false);
    });
  }

  /**
   * Sync pending items TO Firestore (batched for efficiency)
   */
  private async flushToFirestore(): Promise<void> {
    if (!this.currentUserId || this.firestoreSyncPending.length === 0 || this.firestoreSyncInProgress) {
      return;
    }

    this.firestoreSyncInProgress = true;
    const itemsToSync = [...this.firestoreSyncPending];
    this.firestoreSyncPending = [];

    try {
      const batch = writeBatch(this.firestore);

      for (const item of itemsToSync) {
        const docRef = doc(
          this.firestore,
          `users/${this.currentUserId}/${FIRESTORE_COLLECTION}/${item.id}`
        );
        batch.set(docRef, {
          data: item.data,
          cachedAt: Timestamp.fromDate(new Date(item.cachedAt)),
          expiresAt: Timestamp.fromDate(new Date(item.expiresAt))
        });
      }

      await batch.commit();
      this.logger.debug('CacheService', `Flushed ${itemsToSync.length} items to Firestore`);
    } catch (error) {
      this.logger.error('CacheService', 'Failed to flush to Firestore:', error);
      // Re-add failed items to pending queue
      this.firestoreSyncPending.push(...itemsToSync);
    } finally {
      this.firestoreSyncInProgress = false;
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
   * Store item in cache (IndexedDB + Firestore)
   */
  async set(item: FeedItem, ttlHours: number = 168): Promise<void> {
    await this.ensureReady();
    const cachedItem: CachedItem = {
      id: item.id,
      data: item,
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000)
    };

    // Save to IndexedDB (fast, local)
    await new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(cachedItem);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Queue for Firestore sync (async, batched)
    if (this.currentUserId) {
      this.firestoreSyncPending.push(cachedItem);
      this.logger.info('CacheService', `Queued item for Firestore sync: ${item.id} (pending: ${this.firestoreSyncPending.length})`);

      // Flush every 20 items or after 500ms (faster sync)
      if (this.firestoreSyncPending.length >= 20) {
        this.flushToFirestore();
      } else {
        // Short debounce flush
        setTimeout(() => this.flushToFirestore(), 500);
      }
    }
  }

  /**
   * Delete item from cache by ID
   */
  async delete(id: string): Promise<void> {
    await this.ensureReady();

    // Delete from IndexedDB
    await new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Delete from Firestore
    if (this.currentUserId) {
      try {
        const docRef = doc(
          this.firestore,
          `users/${this.currentUserId}/${FIRESTORE_COLLECTION}/${id}`
        );
        await deleteDoc(docRef);
      } catch (error) {
        this.logger.warn('CacheService', 'Failed to delete from Firestore:', error);
      }
    }
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
   * Clear expired items from cache (IndexedDB + Firestore)
   */
  async clearExpired(): Promise<number> {
    await this.ensureReady();

    const expiredIds: string[] = [];

    const deleted = await new Promise<number>((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      let deletedCount = 0;

      request.onsuccess = () => {
        const items = request.result as CachedItem[];
        const now = new Date();
        items.forEach(item => {
          if (new Date(item.expiresAt) <= now) {
            store.delete(item.id);
            expiredIds.push(item.id);
            deletedCount++;
          }
        });
        resolve(deletedCount);
      };
      request.onerror = () => resolve(0);
    });

    // Also delete from Firestore
    if (this.currentUserId && expiredIds.length > 0) {
      try {
        const batch = writeBatch(this.firestore);
        for (const id of expiredIds.slice(0, 500)) { // Firestore batch limit
          const docRef = doc(
            this.firestore,
            `users/${this.currentUserId}/${FIRESTORE_COLLECTION}/${id}`
          );
          batch.delete(docRef);
        }
        await batch.commit();
      } catch (error) {
        this.logger.warn('CacheService', 'Failed to clear expired from Firestore:', error);
      }
    }

    return deleted;
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    await this.ensureReady();

    // Clear IndexedDB
    await new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Note: We don't clear Firestore here to allow sync back if user cleared by mistake
    this.logger.info('CacheService', 'Cleared local cache');
  }
}
