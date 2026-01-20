import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, setDoc, getDocs, getDoc, query, orderBy, limit, writeBatch, Timestamp, deleteDoc } from '@angular/fire/firestore';
import { FeedbackItem, FeedbackGroup, Sentiment, FeedbackCategory, FeedbackSourceType } from '../models/feedback.model';
import { LoggerService } from './logger.service';

/**
 * Sync state for incremental fetching
 */
export interface SyncState {
  twitter: Date | null;
  githubIssues: Date | null;
  githubDiscussions: Date | null;
  discourse: Date | null;
  lastSync: Date;
}

/**
 * SharedFeedbackService manages shared Firestore collections
 * All @google.com users can read/write the same analyzed feedback data
 */
@Injectable({
  providedIn: 'root'
})
export class SharedFeedbackService {
  private firestore = inject(Firestore);
  private logger = inject(LoggerService);

  private readonly ITEMS_COLLECTION = 'feedback_items';
  private readonly GROUPS_COLLECTION = 'feedback_groups';
  private readonly SYNC_STATE_DOC = 'config/sync_state';

  /**
   * Save analyzed items to Firestore (shared collection)
   */
  async saveItems(items: FeedbackItem[]): Promise<void> {
    if (items.length === 0) return;

    const batch = writeBatch(this.firestore);
    const itemsRef = collection(this.firestore, this.ITEMS_COLLECTION);

    for (const item of items) {
      const docRef = doc(itemsRef, item.id);
      batch.set(docRef, this.serializeItem(item), { merge: true });
    }

    try {
      await batch.commit();
      this.logger.info('SharedFeedback', `Saved ${items.length} items to Firestore`);
    } catch (error) {
      this.logger.error('SharedFeedback', 'Failed to save items:', error);
      throw error;
    }
  }

  /**
   * Load all analyzed items from Firestore
   */
  async loadItems(): Promise<FeedbackItem[]> {
    try {
      const itemsRef = collection(this.firestore, this.ITEMS_COLLECTION);
      const q = query(itemsRef, orderBy('publishedAt', 'desc'), limit(1000));
      const snapshot = await getDocs(q);

      const items = snapshot.docs.map(doc => this.deserializeItem(doc.data()));
      this.logger.info('SharedFeedback', `Loaded ${items.length} items from Firestore`);
      return items;
    } catch (error) {
      this.logger.error('SharedFeedback', 'Failed to load items:', error);
      return [];
    }
  }

  /**
   * Get already analyzed item IDs to skip re-analysis
   */
  async getAnalyzedItemIds(): Promise<Set<string>> {
    try {
      const itemsRef = collection(this.firestore, this.ITEMS_COLLECTION);
      const snapshot = await getDocs(itemsRef);
      return new Set(snapshot.docs.map(doc => doc.id));
    } catch (error) {
      this.logger.error('SharedFeedback', 'Failed to get analyzed IDs:', error);
      return new Set();
    }
  }

  /**
   * Save groups to Firestore
   */
  async saveGroups(groups: FeedbackGroup[]): Promise<void> {
    if (groups.length === 0) return;

    const batch = writeBatch(this.firestore);
    const groupsRef = collection(this.firestore, this.GROUPS_COLLECTION);

    for (const group of groups) {
      const docRef = doc(groupsRef, group.id);
      batch.set(docRef, this.serializeGroup(group), { merge: true });
    }

    try {
      await batch.commit();
      this.logger.info('SharedFeedback', `Saved ${groups.length} groups to Firestore`);
    } catch (error) {
      this.logger.error('SharedFeedback', 'Failed to save groups:', error);
      throw error;
    }
  }

  /**
   * Load groups from Firestore
   */
  async loadGroups(): Promise<FeedbackGroup[]> {
    try {
      const groupsRef = collection(this.firestore, this.GROUPS_COLLECTION);
      const snapshot = await getDocs(groupsRef);

      const groups = snapshot.docs.map(doc => this.deserializeGroup(doc.data()));
      this.logger.info('SharedFeedback', `Loaded ${groups.length} groups from Firestore`);
      return groups;
    } catch (error) {
      this.logger.error('SharedFeedback', 'Failed to load groups:', error);
      return [];
    }
  }

  /**
   * Clear all groups (for re-grouping)
   */
  async clearGroups(): Promise<void> {
    try {
      const groupsRef = collection(this.firestore, this.GROUPS_COLLECTION);
      const snapshot = await getDocs(groupsRef);
      const batch = writeBatch(this.firestore);
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      this.logger.info('SharedFeedback', 'Cleared all groups');
    } catch (error) {
      this.logger.error('SharedFeedback', 'Failed to clear groups:', error);
    }
  }

  /**
   * Delete specific items by ID
   */
  async deleteItems(itemIds: string[]): Promise<void> {
    if (itemIds.length === 0) return;

    try {
      const itemsRef = collection(this.firestore, this.ITEMS_COLLECTION);

      // Firestore batch limit is 500, process in chunks
      const chunkSize = 500;
      for (let i = 0; i < itemIds.length; i += chunkSize) {
        const chunk = itemIds.slice(i, i + chunkSize);
        const batch = writeBatch(this.firestore);

        for (const itemId of chunk) {
          const docRef = doc(itemsRef, itemId);
          batch.delete(docRef);
        }

        await batch.commit();
      }

      this.logger.info('SharedFeedback', `Deleted ${itemIds.length} items from cache`);
    } catch (error) {
      this.logger.error('SharedFeedback', 'Failed to delete items:', error);
      throw error;
    }
  }

  /**
   * Clear ALL cached data (items + groups)
   */
  async clearAllItems(): Promise<void> {
    try {
      // Delete all items
      const itemsRef = collection(this.firestore, this.ITEMS_COLLECTION);
      const itemsSnapshot = await getDocs(itemsRef);

      const chunkSize = 500;
      const itemDocs = itemsSnapshot.docs;

      for (let i = 0; i < itemDocs.length; i += chunkSize) {
        const chunk = itemDocs.slice(i, i + chunkSize);
        const batch = writeBatch(this.firestore);
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }

      this.logger.info('SharedFeedback', `Cleared ${itemDocs.length} items from cache`);

      // Also clear groups
      await this.clearGroups();
    } catch (error) {
      this.logger.error('SharedFeedback', 'Failed to clear all items:', error);
      throw error;
    }
  }

  // ============================================================
  // Sync State (for incremental sync)
  // ============================================================

  /**
   * Save sync state for incremental fetching
   */
  async saveSyncState(state: SyncState): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.SYNC_STATE_DOC);
      await setDoc(docRef, {
        twitter: state.twitter ? Timestamp.fromDate(state.twitter) : null,
        githubIssues: state.githubIssues ? Timestamp.fromDate(state.githubIssues) : null,
        githubDiscussions: state.githubDiscussions ? Timestamp.fromDate(state.githubDiscussions) : null,
        discourse: state.discourse ? Timestamp.fromDate(state.discourse) : null,
        lastSync: Timestamp.fromDate(state.lastSync),
      });
      this.logger.info('SharedFeedback', 'Saved sync state');
    } catch (error) {
      this.logger.error('SharedFeedback', 'Failed to save sync state:', error);
    }
  }

  /**
   * Load sync state for incremental fetching
   */
  async loadSyncState(): Promise<SyncState | null> {
    try {
      const docRef = doc(this.firestore, this.SYNC_STATE_DOC);
      const snapshot = await getDoc(docRef);

      if (!snapshot.exists()) {
        this.logger.info('SharedFeedback', 'No sync state found (first sync)');
        return null;
      }

      const data = snapshot.data();
      return {
        twitter: data['twitter']?.toDate() || null,
        githubIssues: data['githubIssues']?.toDate() || null,
        githubDiscussions: data['githubDiscussions']?.toDate() || null,
        discourse: data['discourse']?.toDate() || null,
        lastSync: data['lastSync']?.toDate() || new Date(0),
      };
    } catch (error) {
      this.logger.error('SharedFeedback', 'Failed to load sync state:', error);
      return null;
    }
  }

  private serializeItem(item: FeedbackItem): Record<string, any> {
    return {
      id: item.id,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      title: item.title || null,
      content: item.content,
      author: item.author,
      authorHandle: item.authorHandle || null,
      authorAvatar: item.authorAvatar || null,
      publishedAt: Timestamp.fromDate(item.publishedAt),
      url: item.url,
      sentiment: item.sentiment || null,
      sentimentConfidence: item.sentimentConfidence || null,
      category: item.category || null,
      categoryConfidence: item.categoryConfidence || null,
      groupId: item.groupId || null,
      language: item.language || null,
      replyCount: item.replyCount || 0,
      reactionCount: item.reactionCount || 0,
      isReply: item.isReply || false,
      parentId: item.parentId || null,
      labels: item.labels || null,
      state: item.state || null,
      repo: item.repo || null,
      analyzed: item.analyzed,
      dismissed: item.dismissed,
      updatedAt: Timestamp.now(),
    };
  }

  private deserializeItem(data: Record<string, any>): FeedbackItem {
    return {
      id: data['id'],
      sourceType: data['sourceType'] as FeedbackSourceType,
      sourceId: data['sourceId'],
      sourceName: data['sourceName'],
      title: data['title'] || undefined,
      content: data['content'],
      author: data['author'],
      authorHandle: data['authorHandle'] || undefined,
      authorAvatar: data['authorAvatar'] || undefined,
      publishedAt: data['publishedAt']?.toDate?.() || new Date(data['publishedAt']),
      url: data['url'],
      sentiment: data['sentiment'] as Sentiment || undefined,
      sentimentConfidence: data['sentimentConfidence'] || undefined,
      category: data['category'] as FeedbackCategory || undefined,
      categoryConfidence: data['categoryConfidence'] || undefined,
      groupId: data['groupId'] || undefined,
      language: data['language'] || undefined,
      replyCount: data['replyCount'] || 0,
      reactionCount: data['reactionCount'] || 0,
      isReply: data['isReply'] || false,
      parentId: data['parentId'] || undefined,
      labels: data['labels'] || undefined,
      state: data['state'] || undefined,
      repo: data['repo'] || undefined,
      selected: false,
      analyzed: data['analyzed'] || false,
      dismissed: data['dismissed'] || false,
    };
  }

  private serializeGroup(group: FeedbackGroup): Record<string, any> {
    return {
      id: group.id,
      theme: group.theme,
      summary: group.summary,
      sentiment: group.sentiment,
      category: group.category,
      itemIds: group.itemIds,
      itemCount: group.itemCount,
      sources: group.sources,
      languages: group.languages,
      createdAt: Timestamp.fromDate(group.createdAt),
      updatedAt: Timestamp.now(),
    };
  }

  private deserializeGroup(data: Record<string, any>): FeedbackGroup {
    return {
      id: data['id'],
      theme: data['theme'],
      summary: data['summary'],
      sentiment: data['sentiment'] as Sentiment,
      category: data['category'] as FeedbackCategory,
      itemIds: data['itemIds'] || [],
      itemCount: data['itemCount'] || 0,
      sources: data['sources'] || [],
      languages: data['languages'] || [],
      createdAt: data['createdAt']?.toDate?.() || new Date(),
      updatedAt: data['updatedAt']?.toDate?.() || new Date(),
    };
  }
}
