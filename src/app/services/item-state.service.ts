import { Injectable, inject, signal, effect } from '@angular/core';
import { Firestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, writeBatch } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { LoggerService } from './logger.service';

/**
 * Interface for item state stored in Firestore
 */
export interface ItemState {
  itemHash: string;
  used: boolean;
  irrelevant: boolean;
  markedAt: Date;
}

/**
 * ItemStateService manages the persistence of item states (used, irrelevant)
 * in Firestore for multi-device synchronization.
 * 
 * Structure: users/{userId}/itemStates/{itemHash}
 */
@Injectable({
  providedIn: 'root'
})
export class ItemStateService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private logger = inject(LoggerService);

  // Local cache of item states
  private statesCache = signal<Map<string, ItemState>>(new Map());
  isLoading = signal(false);
  
  private currentUserId: string | null = null;

  constructor() {
    // Load states when user changes
    effect(() => {
      const user = this.authService.currentUser();
      if (user && user.uid !== this.currentUserId) {
        this.currentUserId = user.uid;
        setTimeout(() => this.loadStates(user.uid), 0);
      } else if (!user) {
        this.currentUserId = null;
        this.statesCache.set(new Map());
      }
    });
  }

  /**
   * Generate a hash for an item based on URL or title
   */
  generateItemHash(url: string | undefined, title: string | undefined, feedId: string): string {
    const key = url || `${title || ''}_${feedId}`;
    // Simple hash function for consistency
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `item_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Load all item states from Firestore
   */
  private async loadStates(userId: string): Promise<void> {
    this.isLoading.set(true);
    
    try {
      const statesRef = collection(this.firestore, `users/${userId}/itemStates`);
      const snapshot = await getDocs(statesRef);
      
      const states = new Map<string, ItemState>();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        states.set(doc.id, {
          itemHash: doc.id,
          used: data['used'] ?? false,
          irrelevant: data['irrelevant'] ?? false,
          markedAt: data['markedAt']?.toDate() ?? new Date()
        });
      });
      
      this.statesCache.set(states);
      this.logger.debug('ItemStateService', `Loaded ${states.size} item states`);
    } catch (error) {
      this.logger.error('ItemStateService', 'Failed to load states:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Check if an item is marked as used
   */
  isUsed(itemHash: string): boolean {
    return this.statesCache().get(itemHash)?.used ?? false;
  }

  /**
   * Check if an item is marked as irrelevant
   */
  isIrrelevant(itemHash: string): boolean {
    return this.statesCache().get(itemHash)?.irrelevant ?? false;
  }

  /**
   * Get the state for an item
   */
  getState(itemHash: string): ItemState | undefined {
    return this.statesCache().get(itemHash);
  }

  /**
   * Mark an item as used
   */
  async markAsUsed(itemHash: string): Promise<void> {
    await this.updateState(itemHash, { used: true });
  }

  /**
   * Mark an item as irrelevant
   */
  async markAsIrrelevant(itemHash: string): Promise<void> {
    await this.updateState(itemHash, { used: true, irrelevant: true });
  }

  /**
   * Mark multiple items as used (batch operation)
   */
  async markMultipleAsUsed(itemHashes: string[]): Promise<void> {
    const userId = this.currentUserId;
    if (!userId || itemHashes.length === 0) return;

    const batch = writeBatch(this.firestore);
    const now = new Date();

    itemHashes.forEach(hash => {
      const docRef = doc(this.firestore, `users/${userId}/itemStates/${hash}`);
      batch.set(docRef, {
        used: true,
        irrelevant: false,
        markedAt: now
      }, { merge: true });
    });

    try {
      await batch.commit();
      
      // Update local cache
      this.statesCache.update(cache => {
        const newCache = new Map(cache);
        itemHashes.forEach(hash => {
          newCache.set(hash, {
            itemHash: hash,
            used: true,
            irrelevant: false,
            markedAt: now
          });
        });
        return newCache;
      });
      
      this.logger.info('ItemStateService', `Marked ${itemHashes.length} items as used`);
    } catch (error) {
      this.logger.error('ItemStateService', 'Batch update failed:', error);
      throw error;
    }
  }

  /**
   * Update state for a single item
   */
  private async updateState(itemHash: string, updates: Partial<ItemState>): Promise<void> {
    const userId = this.currentUserId;
    if (!userId) {
      this.logger.warn('ItemStateService', 'No user logged in');
      return;
    }

    const now = new Date();
    const docRef = doc(this.firestore, `users/${userId}/itemStates/${itemHash}`);
    
    try {
      await setDoc(docRef, {
        ...updates,
        markedAt: now
      }, { merge: true });

      // Update local cache
      this.statesCache.update(cache => {
        const newCache = new Map(cache);
        const existing = cache.get(itemHash);
        newCache.set(itemHash, {
          itemHash,
          used: updates.used ?? existing?.used ?? false,
          irrelevant: updates.irrelevant ?? existing?.irrelevant ?? false,
          markedAt: now
        });
        return newCache;
      });
    } catch (error) {
      this.logger.error('ItemStateService', 'Failed to update state:', error);
      throw error;
    }
  }

  /**
   * Clear state for an item (unmark)
   */
  async clearState(itemHash: string): Promise<void> {
    const userId = this.currentUserId;
    if (!userId) return;

    const docRef = doc(this.firestore, `users/${userId}/itemStates/${itemHash}`);
    
    try {
      await deleteDoc(docRef);
      
      this.statesCache.update(cache => {
        const newCache = new Map(cache);
        newCache.delete(itemHash);
        return newCache;
      });
    } catch (error) {
      this.logger.error('ItemStateService', 'Failed to clear state:', error);
    }
  }

  /**
   * Get all states (for debugging/export)
   */
  getAllStates(): Map<string, ItemState> {
    return this.statesCache();
  }
}
