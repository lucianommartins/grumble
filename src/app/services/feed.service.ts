import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Firestore, doc, setDoc, deleteDoc, collection, getDocs, writeBatch, Timestamp } from '@angular/fire/firestore';
import { Feed } from '../models/feed.model';
import { AuthService } from './auth.service';
import { DEFAULT_FEEDS } from '../config/default-feeds';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root'
})
export class FeedService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private logger = inject(LoggerService);

  feeds = signal<Feed[]>([]);
  isLoading = signal(false);

  // Track enabled feed types (twitter, rss, blog)
  private _enabledTypes = signal<Set<string>>(new Set(['twitter', 'rss', 'blog', 'youtube']));

  // Computed to expose enabled types as reactive
  enabledTypes = computed(() => this._enabledTypes());

  private currentUserId: string | null = null;
  private firestoreInitialized = false;

  constructor() {
    // Sync with Firestore when user logs in
    effect(() => {
      const user = this.authService.currentUser();
      if (user && user.uid !== this.currentUserId) {
        this.currentUserId = user.uid;
        this.logger.info('FeedService', `User logged in: ${user.uid}, loading feeds from Firestore...`);
        setTimeout(() => this.loadFromFirestore(user.uid), 0);
      } else if (!user) {
        this.currentUserId = null;
        this.firestoreInitialized = false;
        this.feeds.set([]);
      }
    });
  }

  /**
   * Load feeds from Firestore (single source of truth)
   */
  private async loadFromFirestore(userId: string): Promise<void> {
    this.isLoading.set(true);

    try {
      const feedsRef = collection(this.firestore, `users/${userId}/feeds`);
      const snapshot = await getDocs(feedsRef);

      const firestoreFeeds: Feed[] = [];
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        firestoreFeeds.push({
          id: docSnap.id,
          name: data['name'],
          url: data['url'],
          type: data['type'],
          enabled: data['enabled'] ?? true,
          createdAt: this.parseDate(data['createdAt']) ?? new Date(),
          lastSync: this.parseDate(data['lastSync']) ?? undefined
        });
      });

      // Initialize default feeds if empty
      if (firestoreFeeds.length === 0) {
        const defaultFeeds = await this.initializeDefaultFeeds(userId);
        this.feeds.set(defaultFeeds);
      } else {
        this.feeds.set(firestoreFeeds);
      }

      // Load enabled types from Firestore
      await this.loadEnabledTypesFromFirestore(userId);

      this.firestoreInitialized = true;
      this.logger.info('FeedService', `Loaded ${this.feeds().length} feeds from Firestore`);
    } catch (error) {
      this.logger.error('FeedService', 'Failed to load from Firestore:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Initialize default feeds on first run
   */
  private async initializeDefaultFeeds(userId: string): Promise<Feed[]> {
    const newFeeds: Feed[] = [];
    const batch = writeBatch(this.firestore);

    for (const defaultFeed of DEFAULT_FEEDS) {
      const newFeed: Feed = {
        ...defaultFeed,
        id: this.generateId(),
        createdAt: new Date()
      };
      newFeeds.push(newFeed);

      const docRef = doc(this.firestore, `users/${userId}/feeds/${newFeed.id}`);
      batch.set(docRef, {
        name: newFeed.name,
        url: newFeed.url,
        type: newFeed.type,
        enabled: newFeed.enabled,
        createdAt: Timestamp.fromDate(newFeed.createdAt),
        lastSync: null
      });
    }

    await batch.commit();
    this.logger.info('FeedService', `Initialized ${newFeeds.length} default feeds`);
    return newFeeds;
  }

  /**
   * Load enabled types from Firestore settings
   */
  private async loadEnabledTypesFromFirestore(userId: string): Promise<void> {
    try {
      const settingsRef = doc(this.firestore, `users/${userId}/settings/feedPreferences`);
      const { getDoc } = await import('@angular/fire/firestore');
      const snapshot = await getDoc(settingsRef);

      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data['enabledTypes']) {
          this._enabledTypes.set(new Set(data['enabledTypes']));
        }
      }
    } catch (error) {
      this.logger.warn('FeedService', 'Failed to load enabled types:', error);
    }
  }

  /**
   * Parse date from Firestore (handles Timestamp, Date, string, or number)
   */
  private parseDate(value: unknown): Date | null {
    if (!value) return null;
    // Firestore Timestamp
    if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate();
    }
    // Already a Date
    if (value instanceof Date) return value;
    // String or number
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  /**
   * Save enabled types to Firestore
   */
  private async saveEnabledTypesToFirestore(): Promise<void> {
    if (!this.currentUserId) return;

    try {
      const settingsRef = doc(this.firestore, `users/${this.currentUserId}/settings/feedPreferences`);
      await setDoc(settingsRef, {
        enabledTypes: [...this._enabledTypes()]
      }, { merge: true });
    } catch (error) {
      this.logger.warn('FeedService', 'Failed to save enabled types:', error);
    }
  }

  /**
   * Normalize URL for comparison (handles http/https, www, trailing slashes)
   */
  private normalizeUrl(url: string): string {
    return url
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .replace(/^@/, '')  // Twitter handles
      .trim();
  }

  /**
   * Check if a feed with the same URL already exists
   */
  feedExistsByUrl(url: string): boolean {
    const normalizedUrl = this.normalizeUrl(url);
    return this.feeds().some(f => this.normalizeUrl(f.url) === normalizedUrl);
  }

  private generateId(): string {
    return `feed_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Save a feed to Firestore
   */
  private async saveFeed(feed: Feed): Promise<void> {
    if (!this.currentUserId || !this.firestoreInitialized) return;

    try {
      const docRef = doc(this.firestore, `users/${this.currentUserId}/feeds/${feed.id}`);
      await setDoc(docRef, {
        name: feed.name,
        url: feed.url,
        type: feed.type,
        enabled: feed.enabled,
        createdAt: Timestamp.fromDate(new Date(feed.createdAt)),
        lastSync: feed.lastSync ? Timestamp.fromDate(new Date(feed.lastSync)) : null
      });
    } catch (error) {
      this.logger.error('FeedService', 'Failed to save to Firestore:', error);
    }
  }

  /**
   * Delete a feed from Firestore
   */
  private async deleteFeedFromFirestore(feedId: string): Promise<void> {
    if (!this.currentUserId || !this.firestoreInitialized) return;

    try {
      const docRef = doc(this.firestore, `users/${this.currentUserId}/feeds/${feedId}`);
      await deleteDoc(docRef);
    } catch (error) {
      this.logger.error('FeedService', 'Failed to delete from Firestore:', error);
    }
  }

  addFeed(feed: Omit<Feed, 'id' | 'createdAt'>): Feed | null {
    // Check for duplicates
    if (this.feedExistsByUrl(feed.url)) {
      this.logger.warn('FeedService', `Feed with URL "${feed.url}" already exists`);
      return null;
    }

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
    this.deleteFeedFromFirestore(id);
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
  async soloFeed(id: string): Promise<void> {
    this.feeds.update(feeds =>
      feeds.map(f => ({ ...f, enabled: f.id === id }))
    );

    // Save all feeds to sync enabled states
    if (this.currentUserId && this.firestoreInitialized) {
      const batch = writeBatch(this.firestore);
      for (const feed of this.feeds()) {
        const docRef = doc(this.firestore, `users/${this.currentUserId}/feeds/${feed.id}`);
        batch.set(docRef, { enabled: feed.enabled }, { merge: true });
      }
      await batch.commit();
    }
  }

  /**
   * Enable all feeds
   */
  async enableAllFeeds(): Promise<void> {
    this.feeds.update(feeds =>
      feeds.map(f => ({ ...f, enabled: true }))
    );

    if (this.currentUserId && this.firestoreInitialized) {
      const batch = writeBatch(this.firestore);
      for (const feed of this.feeds()) {
        const docRef = doc(this.firestore, `users/${this.currentUserId}/feeds/${feed.id}`);
        batch.set(docRef, { enabled: true }, { merge: true });
      }
      await batch.commit();
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
    this.saveEnabledTypesToFirestore();
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
