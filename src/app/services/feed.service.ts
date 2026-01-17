import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Firestore, doc, setDoc, deleteDoc, collection, getDocs, writeBatch } from '@angular/fire/firestore';
import { Feed } from '../models/feed.model';
import { AuthService } from './auth.service';

const FEEDS_STORAGE_KEY = 'devpulse-feeds';
const ENABLED_TYPES_KEY = 'devpulse-enabled-types';

@Injectable({
  providedIn: 'root'
})
export class FeedService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  feeds = signal<Feed[]>([]);
  isLoading = signal(false);

  // Track enabled feed types (twitter, rss, blog)
  private _enabledTypes = signal<Set<string>>(new Set(['twitter', 'rss', 'blog', 'youtube']));

  // Computed to expose enabled types as reactive
  enabledTypes = computed(() => this._enabledTypes());

  private currentUserId: string | null = null;
  private firestoreInitialized = false;

  constructor() {
    // Load from localStorage immediately for fast startup
    this.loadFeedsFromLocalStorage();
    this.loadEnabledTypes();

    // Sync with Firestore when user logs in
    effect(() => {
      const user = this.authService.currentUser();
      if (user && user.uid !== this.currentUserId) {
        this.currentUserId = user.uid;
        setTimeout(() => this.syncWithFirestore(user.uid), 0);
      } else if (!user) {
        this.currentUserId = null;
        this.firestoreInitialized = false;
      }
    });
  }

  /**
   * Load feeds from localStorage (fast, offline-first)
   */
  private loadFeedsFromLocalStorage(): void {
    const stored = localStorage.getItem(FEEDS_STORAGE_KEY);
    if (stored) {
      try {
        const feeds = JSON.parse(stored) as Feed[];
        this.feeds.set(feeds);
      } catch {
        this.feeds.set([]);
      }
    }
  }

  /**
   * Sync feeds with Firestore (merge strategy)
   */
  private async syncWithFirestore(userId: string): Promise<void> {
    this.isLoading.set(true);

    try {
      const feedsRef = collection(this.firestore, `users/${userId}/feeds`);
      const snapshot = await getDocs(feedsRef);

      const firestoreFeeds: Feed[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        firestoreFeeds.push({
          id: doc.id,
          name: data['name'],
          url: data['url'],
          type: data['type'],
          enabled: data['enabled'] ?? true,
          createdAt: data['createdAt']?.toDate() ?? new Date(),
          lastSync: data['lastSync']?.toDate() ?? null
        });
      });

      const localFeeds = this.feeds();

      // Merge: Firestore is source of truth, but keep local-only feeds
      const mergedFeeds = this.mergeFeeds(localFeeds, firestoreFeeds);
      this.feeds.set(mergedFeeds);

      // Save merged result to both local and Firestore
      this.saveToLocalStorage();
      await this.syncLocalFeedsToFirestore(userId, mergedFeeds);

      this.firestoreInitialized = true;
      console.log(`[FeedService] Synced ${mergedFeeds.length} feeds with Firestore`);
    } catch (error) {
      console.error('[FeedService] Firestore sync failed, using local:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Merge local and Firestore feeds
   */
  private mergeFeeds(local: Feed[], remote: Feed[]): Feed[] {
    const merged = new Map<string, Feed>();

    // Add remote feeds first (source of truth)
    remote.forEach(feed => merged.set(feed.id, feed));

    // Add local feeds that don't exist in remote
    local.forEach(feed => {
      if (!merged.has(feed.id)) {
        merged.set(feed.id, feed);
      }
    });

    return Array.from(merged.values());
  }

  /**
   * Sync local feeds to Firestore (upload new ones)
   */
  private async syncLocalFeedsToFirestore(userId: string, feeds: Feed[]): Promise<void> {
    const batch = writeBatch(this.firestore);

    feeds.forEach(feed => {
      const docRef = doc(this.firestore, `users/${userId}/feeds/${feed.id}`);
      batch.set(docRef, {
        name: feed.name,
        url: feed.url,
        type: feed.type,
        enabled: feed.enabled,
        createdAt: feed.createdAt,
        lastSync: feed.lastSync || null
      }, { merge: true });
    });

    await batch.commit();
  }

  private loadEnabledTypes(): void {
    const stored = localStorage.getItem(ENABLED_TYPES_KEY);
    if (stored) {
      try {
        const types = JSON.parse(stored) as string[];
        this._enabledTypes.set(new Set(types));
      } catch {
        // Keep default all enabled
      }
    }
  }

  private saveToLocalStorage(): void {
    localStorage.setItem(FEEDS_STORAGE_KEY, JSON.stringify(this.feeds()));
  }

  private saveEnabledTypes(): void {
    localStorage.setItem(ENABLED_TYPES_KEY, JSON.stringify([...this._enabledTypes()]));
  }

  /**
   * Save a feed to both localStorage and Firestore
   */
  private async saveFeed(feed: Feed): Promise<void> {
    this.saveToLocalStorage();

    if (this.currentUserId && this.firestoreInitialized) {
      try {
        const docRef = doc(this.firestore, `users/${this.currentUserId}/feeds/${feed.id}`);
        await setDoc(docRef, {
          name: feed.name,
          url: feed.url,
          type: feed.type,
          enabled: feed.enabled,
          createdAt: feed.createdAt,
          lastSync: feed.lastSync || null
        });
      } catch (error) {
        console.error('[FeedService] Failed to save to Firestore:', error);
      }
    }
  }

  /**
   * Delete a feed from both localStorage and Firestore
   */
  private async deleteFeed(feedId: string): Promise<void> {
    this.saveToLocalStorage();

    if (this.currentUserId && this.firestoreInitialized) {
      try {
        const docRef = doc(this.firestore, `users/${this.currentUserId}/feeds/${feedId}`);
        await deleteDoc(docRef);
      } catch (error) {
        console.error('[FeedService] Failed to delete from Firestore:', error);
      }
    }
  }

  private generateId(): string {
    return `feed_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  addFeed(feed: Omit<Feed, 'id' | 'createdAt'>): Feed {
    const newFeed: Feed = {
      ...feed,
      id: this.generateId(),
      createdAt: new Date()
    };
    this.feeds.update(feeds => [...feeds, newFeed]);
    this.saveFeed(newFeed);
    return newFeed;
  }

  updateFeed(id: string, updates: Partial<Feed>): void {
    let updatedFeed: Feed | null = null;
    this.feeds.update(feeds =>
      feeds.map(f => {
        if (f.id === id) {
          updatedFeed = { ...f, ...updates };
          return updatedFeed;
        }
        return f;
      })
    );
    if (updatedFeed) {
      this.saveFeed(updatedFeed);
    }
  }

  removeFeed(id: string): void {
    this.feeds.update(feeds => feeds.filter(f => f.id !== id));
    this.deleteFeed(id);
  }

  toggleFeed(id: string): void {
    let toggledFeed: Feed | null = null;
    this.feeds.update(feeds =>
      feeds.map(f => {
        if (f.id === id) {
          toggledFeed = { ...f, enabled: !f.enabled };
          return toggledFeed;
        }
        return f;
      })
    );
    if (toggledFeed) {
      this.saveFeed(toggledFeed);
    }
  }

  /**
   * Enable only this feed (solo mode) - disables all others
   */
  soloFeed(id: string): void {
    this.feeds.update(feeds =>
      feeds.map(f => ({ ...f, enabled: f.id === id }))
    );
    // Save all feeds to sync enabled states
    this.saveToLocalStorage();
    if (this.currentUserId && this.firestoreInitialized) {
      this.syncLocalFeedsToFirestore(this.currentUserId, this.feeds());
    }
  }

  /**
   * Enable all feeds
   */
  enableAllFeeds(): void {
    this.feeds.update(feeds =>
      feeds.map(f => ({ ...f, enabled: true }))
    );
    this.saveToLocalStorage();
    if (this.currentUserId && this.firestoreInitialized) {
      this.syncLocalFeedsToFirestore(this.currentUserId, this.feeds());
    }
  }

  // Toggle entire feed type (twitter, rss, blog)
  toggleType(type: string): void {
    this._enabledTypes.update(types => {
      const newTypes = new Set(types);
      if (newTypes.has(type)) {
        newTypes.delete(type);
      } else {
        newTypes.add(type);
      }
      return newTypes;
    });
    this.saveEnabledTypes();
  }

  isTypeEnabled(type: string): boolean {
    return this._enabledTypes().has(type);
  }

  getEnabledFeeds(): Feed[] {
    return this.feeds().filter(f => f.enabled);
  }

  getFeedsByType(type: Feed['type']): Feed[] {
    return this.feeds().filter(f => f.type === type);
  }
}
