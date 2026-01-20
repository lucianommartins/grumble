import { Injectable, inject, signal, computed } from '@angular/core';
import { FeedbackItem, FeedbackGroup, FeedbackSourceType, Sentiment, FeedbackCategory } from '../models/feedback.model';
import { GitHubService } from './github.service';
import { DiscourseService } from './discourse.service';
import { TwitterSearchService } from './twitter-search.service';
import { SentimentService } from './sentiment.service';
import { SharedFeedbackService } from './shared-feedback.service';
import { CacheService } from './cache.service';
import { LoggerService } from './logger.service';

/**
 * FeedbackService orchestrates fetching from all sources
 * and provides a unified interface for the UI
 */
@Injectable({
  providedIn: 'root'
})
export class FeedbackService {
  private github = inject(GitHubService);
  private discourse = inject(DiscourseService);
  private twitterSearch = inject(TwitterSearchService);
  private sentiment = inject(SentimentService);
  private sharedFeedback = inject(SharedFeedbackService);
  private cache = inject(CacheService);
  private logger = inject(LoggerService);

  // State
  items = signal<FeedbackItem[]>([]);
  groups = signal<FeedbackGroup[]>([]);
  isLoading = signal(false);
  lastSyncAt = signal<Date | null>(null);

  // Filter state
  enabledSourceTypes = signal<Set<FeedbackSourceType>>(new Set(['twitter-search', 'github-issue', 'github-discussion', 'discourse']));
  showAnalyzedOnly = signal(false);
  selectedSentiment = signal<Sentiment | null>(null);
  selectedCategory = signal<FeedbackCategory | null>(null);
  selectedGroupId = signal<string | null>(null);
  hideReplies = signal(false);
  hideDismissed = signal(true);

  // Computed filtered items
  filteredItems = computed(() => {
    let result = this.items();

    // Filter by group first (if set)
    const groupId = this.selectedGroupId();
    if (groupId) {
      result = result.filter(item => item.groupId === groupId);
    }

    // Filter by source type
    const enabledTypes = this.enabledSourceTypes();
    result = result.filter(item => enabledTypes.has(item.sourceType));

    // Filter by sentiment
    const sentiment = this.selectedSentiment();
    if (sentiment) {
      result = result.filter(item => item.sentiment === sentiment);
    }

    // Filter by category
    const category = this.selectedCategory();
    if (category) {
      result = result.filter(item => item.category === category);
    }

    // Filter out replies if requested
    if (this.hideReplies()) {
      result = result.filter(item => !item.isReply);
    }

    // Filter out dismissed items
    if (this.hideDismissed()) {
      result = result.filter(item => !item.dismissed);
    }

    // Filter analyzed only
    if (this.showAnalyzedOnly()) {
      result = result.filter(item => item.analyzed);
    }

    // Sort by date (most recent first)
    return result.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  });

  // Selection state
  selectedItems = computed(() => this.items().filter(item => item.selected));
  selectedCount = computed(() => this.selectedItems().length);

  // Stats
  stats = computed(() => {
    const all = this.items();
    return {
      total: all.length,
      analyzed: all.filter(i => i.analyzed).length,
      positive: all.filter(i => i.sentiment === 'positive').length,
      neutral: all.filter(i => i.sentiment === 'neutral').length,
      negative: all.filter(i => i.sentiment === 'negative').length,
      bySource: {
        twitter: all.filter(i => i.sourceType === 'twitter-search').length,
        githubIssues: all.filter(i => i.sourceType === 'github-issue').length,
        githubDiscussions: all.filter(i => i.sourceType === 'github-discussion').length,
        discourse: all.filter(i => i.sourceType === 'discourse').length,
      }
    };
  });

  /**
   * Load cached feedback from Firestore (shared collection)
   * This is called on app startup to show existing data without fetching new
   */
  async loadCachedFeedback(): Promise<void> {
    if (this.isLoading()) return;

    this.isLoading.set(true);
    this.logger.info('Feedback', 'Loading cached feedback from Firestore...');

    try {
      // Load all cached items and groups from shared Firestore
      const [items, groups] = await Promise.all([
        this.sharedFeedback.loadItems(),
        this.sharedFeedback.loadGroups()
      ]);

      if (items.length > 0) {
        this.items.set(items);
        this.groups.set(groups);
        this.lastSyncAt.set(new Date());
        this.logger.info('Feedback', `Loaded ${items.length} items and ${groups.length} groups from cache`);
      } else {
        this.logger.info('Feedback', 'No cached feedback found');
      }
    } catch (error) {
      this.logger.error('Feedback', 'Failed to load cached feedback:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Sync all enabled sources
   */
  async syncAll(): Promise<void> {
    if (this.isLoading()) return;

    this.isLoading.set(true);
    this.logger.info('Feedback', 'Starting sync from all sources...');

    try {
      // First, load already analyzed items from Firebase (shared)
      const existingItems = await this.sharedFeedback.loadItems();
      const existingGroups = await this.sharedFeedback.loadGroups();
      const analyzedIds = new Set(existingItems.filter(i => i.analyzed).map(i => i.id));

      this.logger.info('Feedback', `Loaded ${existingItems.length} items from Firebase (${analyzedIds.size} analyzed)`);

      // Load existing groups
      this.groups.set(existingGroups);

      const allItems: FeedbackItem[] = [];
      const enabledTypes = this.enabledSourceTypes();

      // Fetch from all enabled sources in parallel
      const promises: Promise<FeedbackItem[]>[] = [];

      if (enabledTypes.has('twitter-search')) {
        promises.push(this.twitterSearch.searchAllKeywords());
      }

      if (enabledTypes.has('github-issue') || enabledTypes.has('github-discussion')) {
        promises.push(this.github.fetchAllRepos());
      }

      if (enabledTypes.has('discourse')) {
        promises.push(this.discourse.fetchAllForums(false)); // Skip replies for initial sync
      }

      const results = await Promise.allSettled(promises);

      for (const result of results) {
        if (result.status === 'fulfilled') {
          allItems.push(...result.value);
        } else {
          this.logger.error('Feedback', 'Source sync failed:', result.reason);
        }
      }

      // Deduplicate by ID
      const uniqueItems = this.deduplicateItems(allItems);

      // Merge with existing Firebase data (preserve analyzed state)
      const existingItemsMap = new Map(existingItems.map(i => [i.id, i]));
      const mergedItems = uniqueItems.map(item => {
        const existing = existingItemsMap.get(item.id);
        if (existing) {
          return {
            ...item,
            sentiment: existing.sentiment,
            sentimentConfidence: existing.sentimentConfidence,
            category: existing.category,
            categoryConfidence: existing.categoryConfidence,
            groupId: existing.groupId,
            analyzed: existing.analyzed,
            dismissed: existing.dismissed,
            selected: false,
          };
        }
        return item;
      });

      this.items.set(mergedItems);
      this.lastSyncAt.set(new Date());

      this.logger.info('Feedback', `Sync complete. ${mergedItems.length} items loaded.`);

      // Auto-analyze only NEW items that haven't been analyzed yet
      const unanalyzedItems = mergedItems.filter(i => !i.analyzed && !analyzedIds.has(i.id));
      if (unanalyzedItems.length > 0) {
        this.logger.info('Feedback', `Auto-analyzing ${unanalyzedItems.length} new items...`);
        await this.analyzeAndGroup(unanalyzedItems);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Analyze items progressively (updates UI after each batch)
   */
  async analyzeAndGroup(items: FeedbackItem[]): Promise<void> {
    const batchSize = 10;
    let processedCount = 0;
    const analyzedInThisSession: FeedbackItem[] = [];

    try {
      // Process in batches, updating UI after each
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        try {
          const results = await this.sentiment.analyzeBatchDirect(batch);

          // Update items with this batch's results immediately
          const updatedBatchItems: FeedbackItem[] = [];
          this.items.update(allItems =>
            allItems.map(item => {
              const analysis = results.get(item.id);
              if (analysis) {
                const updated = {
                  ...item,
                  sentiment: analysis.sentiment,
                  sentimentConfidence: analysis.sentimentConfidence,
                  category: analysis.category,
                  categoryConfidence: analysis.categoryConfidence,
                  analyzed: true,
                };
                updatedBatchItems.push(updated);
                return updated;
              }
              return item;
            })
          );

          // Save this batch to Firebase immediately
          if (updatedBatchItems.length > 0) {
            await this.sharedFeedback.saveItems(updatedBatchItems);
            analyzedInThisSession.push(...updatedBatchItems);
          }

          processedCount += batch.length;
          this.logger.debug('Feedback', `Analyzed ${processedCount}/${items.length} items`);

          // Small delay to allow UI to render
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          this.logger.error('Feedback', `Batch ${i / batchSize + 1} failed:`, error);
        }
      }

      this.logger.info('Feedback', `Analysis complete. ${processedCount} items processed.`);

      // Create groups from analyzed items (after all batches)
      const analyzedItems = this.items().filter(i => i.analyzed);
      if (analyzedItems.length >= 10) {
        this.logger.info('Feedback', `Generating feedback groups for ${analyzedItems.length} items...`);

        // Process in batches of 200 to avoid prompt size limits
        const groupBatchSize = 200;
        const allGroups: FeedbackGroup[] = [];

        for (let i = 0; i < analyzedItems.length; i += groupBatchSize) {
          const batch = analyzedItems.slice(i, i + groupBatchSize);
          this.logger.debug('Feedback', `Grouping batch ${i / groupBatchSize + 1}: ${batch.length} items`);

          const batchGroups = await this.sentiment.groupSimilarItems(batch);
          allGroups.push(...batchGroups);
        }

        for (const group of allGroups) {
          const groupIdSet = new Set(group.itemIds);
          this.items.update(allItems =>
            allItems.map(item =>
              groupIdSet.has(item.id) ? { ...item, groupId: group.id } : item
            )
          );
          this.addGroup(group);
        }

        // Save groups to Firebase
        if (allGroups.length > 0) {
          await this.sharedFeedback.saveGroups(allGroups);
          // Also update items with groupId in Firebase
          const itemsWithGroups = this.items().filter(i => i.groupId);
          await this.sharedFeedback.saveItems(itemsWithGroups);
        }

        this.logger.info('Feedback', `Created ${allGroups.length} feedback groups.`);
      }
    } catch (error) {
      this.logger.error('Feedback', 'Analysis failed:', error);
    }
  }

  /**
   * Sync only specific source type
   */
  async syncSource(sourceType: FeedbackSourceType): Promise<void> {
    this.isLoading.set(true);

    try {
      let newItems: FeedbackItem[] = [];

      switch (sourceType) {
        case 'twitter-search':
          newItems = await this.twitterSearch.searchAllKeywords();
          break;
        case 'github-issue':
        case 'github-discussion':
          newItems = await this.github.fetchAllRepos();
          break;
        case 'discourse':
          newItems = await this.discourse.fetchAllForums(true);
          break;
      }

      // Merge with existing items, replacing old ones from same source
      const existingItems = this.items().filter(i => i.sourceType !== sourceType);
      const mergedItems = [...existingItems, ...newItems];

      this.items.set(this.deduplicateItems(mergedItems));
      this.logger.info('Feedback', `Synced ${newItems.length} items from ${sourceType}`);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Remove duplicate items by ID
   */
  private deduplicateItems(items: FeedbackItem[]): FeedbackItem[] {
    const seen = new Map<string, FeedbackItem>();
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.set(item.id, item);
      }
    }
    return Array.from(seen.values());
  }

  /**
   * Toggle item selection
   */
  toggleSelection(id: string): void {
    this.items.update(items =>
      items.map(item =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  }

  /**
   * Select/deselect all visible items
   */
  selectAll(selected: boolean): void {
    const visibleIds = new Set(this.filteredItems().map(i => i.id));
    this.items.update(items =>
      items.map(item =>
        visibleIds.has(item.id) ? { ...item, selected } : item
      )
    );
  }

  /**
   * Dismiss an item (mark as irrelevant)
   */
  dismissItem(id: string): void {
    this.items.update(items =>
      items.map(item =>
        item.id === id ? { ...item, dismissed: true, selected: false } : item
      )
    );
  }

  /**
   * Restore a dismissed item
   */
  restoreItem(id: string): void {
    this.items.update(items =>
      items.map(item =>
        item.id === id ? { ...item, dismissed: false } : item
      )
    );
  }

  /**
   * Update item with analysis results
   */
  updateItemAnalysis(id: string, analysis: {
    sentiment?: Sentiment;
    sentimentConfidence?: number;
    category?: FeedbackCategory;
    categoryConfidence?: number;
    groupId?: string;
  }): void {
    this.items.update(items =>
      items.map(item =>
        item.id === id ? { ...item, ...analysis, analyzed: true } : item
      )
    );
  }

  /**
   * Bulk update multiple items with analysis
   */
  updateMultipleAnalysis(updates: Map<string, {
    sentiment?: Sentiment;
    category?: FeedbackCategory;
    groupId?: string;
  }>): void {
    this.items.update(items =>
      items.map(item => {
        const update = updates.get(item.id);
        return update ? { ...item, ...update, analyzed: true } : item;
      })
    );
  }

  /**
   * Add a feedback group
   */
  addGroup(group: FeedbackGroup): void {
    this.groups.update(groups => [...groups, group]);
  }

  /**
   * Clear all groups
   */
  clearGroups(): void {
    this.groups.set([]);
    // Clear group IDs from items
    this.items.update(items =>
      items.map(item => ({ ...item, groupId: undefined }))
    );
  }

  /**
   * Toggle source type filter
   */
  toggleSourceType(type: FeedbackSourceType): void {
    this.enabledSourceTypes.update(types => {
      const newTypes = new Set(types);
      if (newTypes.has(type)) {
        newTypes.delete(type);
      } else {
        newTypes.add(type);
      }
      return newTypes;
    });
  }

  /**
   * Filter by group
   */
  filterByGroup(groupId: string): void {
    this.selectedGroupId.set(groupId);
  }

  /**
   * Clear group filter
   */
  clearGroupFilter(): void {
    this.selectedGroupId.set(null);
  }

  /**
   * Get items for a specific group
   */
  getGroupItems(groupId: string): FeedbackItem[] {
    return this.items().filter(item => item.groupId === groupId);
  }
}
