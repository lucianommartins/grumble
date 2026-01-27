import { Injectable, inject, signal, computed } from '@angular/core';
import { FeedbackItem, FeedbackGroup, FeedbackSourceType, Sentiment, FeedbackCategory } from '../models/feedback.model';
import { GitHubService } from './github.service';
import { DiscourseService } from './discourse.service';
import { TwitterSearchService } from './twitter-search.service';
import { SentimentService } from './sentiment.service';
import { SharedFeedbackService } from './shared-feedback.service';
import { CacheService } from './cache.service';
import { LoggerService } from './logger.service';
import { I18nService } from '../i18n';
import { SourceConfigService } from './source-config.service';

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
  private i18n = inject(I18nService);
  private sourceConfig = inject(SourceConfigService);

  // State
  items = signal<FeedbackItem[]>([]);
  groups = signal<FeedbackGroup[]>([]);
  isLoading = signal(false);
  syncStatus = signal<{ step: string; message: string } | null>(null);
  lastSyncAt = signal<Date | null>(null);

  // Filter state
  enabledSourceTypes = signal<Set<FeedbackSourceType>>(new Set(['twitter-search', 'github-issue', 'github-discussion', 'discourse']));
  showAnalyzedOnly = signal(false);
  enabledSentiments = signal<Set<Sentiment>>(new Set(['positive', 'neutral', 'negative']));
  enabledCategories = signal<Set<FeedbackCategory>>(new Set(['bug-report', 'feature-request', 'question', 'performance-issue', 'documentation-gap', 'integration-problem', 'breaking-change', 'pricing-quota', 'praise', 'other']));
  selectedGroupId = signal<string | null>(null);
  hideReplies = signal(false);
  hideDismissed = signal(true);
  sortBy = signal<'date' | 'likes' | 'comments'>('date');

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

    // Filter by sentiment (multi-select)
    const enabledSentiments = this.enabledSentiments();
    if (enabledSentiments.size < 3) {
      result = result.filter(item => item.sentiment && enabledSentiments.has(item.sentiment));
    }

    // Filter by category (multi-select)
    const enabledCategories = this.enabledCategories();
    if (enabledCategories.size < 10) {
      result = result.filter(item => item.category && enabledCategories.has(item.category));
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

    // Sort based on selected option
    const sort = this.sortBy();
    switch (sort) {
      case 'likes':
        return result.sort((a, b) => (b.reactionCount || 0) - (a.reactionCount || 0));
      case 'comments':
        return result.sort((a, b) => (b.replyCount || 0) - (a.replyCount || 0));
      case 'date':
      default:
        return result.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    }
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
    this.syncStatus.set({ step: 'loading', message: 'Carregando cache...' });
    this.logger.info('Feedback', 'Starting sync from all sources...');

    try {
      // Load source configs from Firestore (Twitter keywords, GitHub repos, Discourse forums)
      await this.sourceConfig.loadConfigs();

      // First, load already analyzed items from Firebase (shared)
      const existingItems = await this.sharedFeedback.loadItems();
      const existingGroups = await this.sharedFeedback.loadGroups();
      const analyzedIds = new Set(existingItems.filter(i => i.analyzed).map(i => i.id));

      this.logger.info('Feedback', `Loaded ${existingItems.length} items from Firebase (${analyzedIds.size} analyzed)`);

      // Load existing groups
      this.groups.set(existingGroups);

      // Load sync state for incremental fetching
      const syncState = await this.sharedFeedback.loadSyncState();
      const isIncremental = syncState !== null;

      if (isIncremental) {
        this.logger.info('Feedback', `Incremental sync: fetching since ${syncState.lastSync.toISOString()}`);
      } else {
        this.logger.info('Feedback', 'Full sync: no previous sync state found');
      }

      const allItems: FeedbackItem[] = [];
      const enabledTypes = this.enabledSourceTypes();

      // Fetch from all enabled sources in parallel (with since dates for incremental sync)
      this.syncStatus.set({ step: 'fetching', message: 'Coletando das fontes...' });
      const promises: Promise<FeedbackItem[]>[] = [];
      const sourceNames: string[] = [];

      if (enabledTypes.has('twitter-search')) {
        promises.push(this.twitterSearch.searchAllKeywords(syncState?.twitter || undefined));
        sourceNames.push('Twitter');
      }

      if (enabledTypes.has('github-issue') || enabledTypes.has('github-discussion')) {
        const githubSince = syncState
          ? new Date(Math.min(
            syncState.githubIssues?.getTime() || 0,
            syncState.githubDiscussions?.getTime() || 0
          ))
          : undefined;
        promises.push(this.github.fetchAllRepos(githubSince?.getTime() ? githubSince : undefined));
        sourceNames.push('GitHub');
      }

      if (enabledTypes.has('discourse')) {
        promises.push(this.discourse.fetchAllForums(false, syncState?.discourse || undefined));
        sourceNames.push('Discourse');
      }

      console.log(`[Sync] Fetching from ${sourceNames.length} sources: ${sourceNames.join(', ')}`);

      const results = await Promise.allSettled(promises);

      let successSources = 0;
      let failedSources = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const sourceName = sourceNames[i];
        if (result.status === 'fulfilled') {
          allItems.push(...result.value);
          console.log(`[Sync] ${sourceName}: ${result.value.length} items`);
          successSources++;
        } else {
          const reason = result.reason?.message || String(result.reason);
          console.error(`[Sync] ${sourceName} FAILED: ${reason}`);
          failedSources++;
        }
      }

      console.log(`[Sync] Fetch complete: ${successSources} OK, ${failedSources} failed | Total: ${allItems.length} items`);

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

      console.log(`[Sync] Merged: ${mergedItems.length} unique items`);

      // Auto-analyze only NEW items that haven't been analyzed yet
      const unanalyzedItems = mergedItems.filter(i => !i.analyzed && !analyzedIds.has(i.id));
      if (unanalyzedItems.length > 0) {
        console.log(`[Sync] ${unanalyzedItems.length} new items to analyze`);
        await this.analyzeAndGroup(unanalyzedItems);
      } else {
        console.log(`[Sync] All items already analyzed`);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Analyze items progressively (updates UI after each batch)
   */
  async analyzeAndGroup(items: FeedbackItem[]): Promise<void> {
    const batchSize = 100;
    let processedCount = 0;
    const analyzedInThisSession: FeedbackItem[] = [];

    this.syncStatus.set({ step: 'analyzing', message: `Analisando sentimento 0 de ${items.length}...` });

    // Metrics
    let successBatches = 0;
    let failedBatches = 0;

    try {
      // Process in parallel batches (10 concurrent batches of 100 items = 1000 items at a time)
      const parallelBatches = 10;
      const batchGroups: FeedbackItem[][] = [];

      // Create all batches first
      for (let i = 0; i < items.length; i += batchSize) {
        batchGroups.push(items.slice(i, i + batchSize));
      }

      console.log(`[Sentiment] Starting: ${batchGroups.length} batches, ${parallelBatches} parallel`);

      const totalGroups = Math.ceil(batchGroups.length / parallelBatches);

      // Process batches in groups of 10 in parallel
      for (let g = 0; g < batchGroups.length; g += parallelBatches) {
        const parallelGroup = batchGroups.slice(g, g + parallelBatches);
        const groupNum = Math.floor(g / parallelBatches) + 1;
        console.log(`[Sentiment] Group ${groupNum}/${totalGroups}: Processing ${parallelGroup.length} batches...`);

        let groupSuccess = 0;
        let groupFailed = 0;

        // Each promise updates progress immediately when it completes
        const wrappedPromises = parallelGroup.map(async (batch, batchIndex) => {
          const batchNum = g + batchIndex + 1;

          let results: Map<string, any>;
          let success = true;

          try {
            results = await this.sentiment.analyzeBatchDirect(batch);
          } catch (error: any) {
            const errorMsg = error?.message || String(error);
            console.error(`[Sentiment] Batch ${batchNum} FAILED: ${errorMsg}`);
            results = new Map();
            success = false;
          }

          // Update progress IMMEDIATELY when this batch completes
          processedCount += batch.length;
          this.syncStatus.set({ step: 'analyzing', message: `Analisando sentimento ${processedCount} de ${items.length}...` });

          return { success, results, batch };
        });

        // Wait for all parallel batches to complete
        const allResults = await Promise.all(wrappedPromises);

        // Process results (update items, save to Firestore)
        for (const result of allResults) {
          if (result.success) {
            groupSuccess++;
            const updatedBatchItems: FeedbackItem[] = [];

            this.items.update(allItems =>
              allItems.map(item => {
                const analysis = result.results.get(item.id);
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

            if (updatedBatchItems.length > 0) {
              await this.sharedFeedback.saveItems(updatedBatchItems);
              analyzedInThisSession.push(...updatedBatchItems);
            }
          } else {
            groupFailed++;
          }
        }

        successBatches += groupSuccess;
        failedBatches += groupFailed;
        console.log(`[Sentiment] Group ${groupNum} complete: ${groupSuccess} OK, ${groupFailed} failed | Progress: ${processedCount}/${items.length}`);
      }

      console.log(`[Sentiment] COMPLETE: ${processedCount} items | Batches: ${successBatches} OK, ${failedBatches} failed`);

      // Translate items to ALL 8 languages at sync time (including items without detected language)
      // Check for null, undefined, or empty translations object
      const itemsNeedingTranslation = this.items().filter(i =>
        i.translations === null ||
        i.translations === undefined ||
        Object.keys(i.translations).length === 0
      );
      this.logger.info('Feedback', `Items needing translation: ${itemsNeedingTranslation.length} of ${this.items().length}`);

      if (itemsNeedingTranslation.length > 0) {
        this.syncStatus.set({ step: 'translating', message: `Traduzindo 0 de ${itemsNeedingTranslation.length}...` });
        this.logger.info('Feedback', `Translating ${itemsNeedingTranslation.length} items to all 8 languages...`);
        const translations = await this.sentiment.translateToAllLanguages(
          itemsNeedingTranslation,
          (current, total) => {
            this.syncStatus.set({ step: 'translating', message: `Traduzindo ${current} de ${total}...` });
          }
        );
        this.logger.info('Feedback', `Translation returned ${translations.size} of ${itemsNeedingTranslation.length} items`);

        if (translations.size > 0) {
          this.logger.info('Feedback', `Updating ${translations.size} items with translations...`);

          this.items.update(allItems =>
            allItems.map(item => {
              const translation = translations.get(item.id);
              if (translation) {
                return {
                  ...item,
                  translations: translation.translations,
                  translatedTitles: translation.translatedTitles,
                  // Use detected language if item doesn't have one
                  language: item.language || translation.detectedLanguage || undefined,
                };
              }
              return item;
            })
          );

          const updatedItems = this.items().filter(i => i.translatedTitles);
          this.logger.info('Feedback', `${updatedItems.length} items now have translatedTitles`);

          // Save translated items to Firestore for caching (all users benefit)
          const translatedItems = this.items().filter(i => i.translations);
          this.logger.info('Feedback', `Saving ${translatedItems.length} translated items to Firestore...`);
          try {
            await this.sharedFeedback.saveItems(translatedItems);
            this.logger.info('Feedback', `Saved ${translations.size} items with translations to all languages`);
          } catch (saveError) {
            this.logger.error('Feedback', 'Failed to save translations to Firestore:', saveError);
          }
        } else {
          this.logger.warn('Feedback', 'No translations were generated - all batches may have failed');
        }
      }

      // Create groups from analyzed items (after all batches)
      const analyzedItems = this.items().filter(i => i.analyzed);
      if (analyzedItems.length >= 10) {
        this.syncStatus.set({ step: 'grouping', message: `Agrupando 0 de ${analyzedItems.length} itens...` });
        this.logger.info('Feedback', `Generating feedback groups for ${analyzedItems.length} items...`);

        // Process in parallel batches (10 concurrent batches of 200 items = 2000 items at a time)
        const groupBatchSize = 200;
        const parallelGroupBatches = 10;
        const allGroups: FeedbackGroup[] = [];
        const groupBatches: FeedbackItem[][] = [];
        let groupedCount = 0;

        // Create all batches first
        for (let i = 0; i < analyzedItems.length; i += groupBatchSize) {
          groupBatches.push(analyzedItems.slice(i, i + groupBatchSize));
        }

        // Process batches in groups of 10 in parallel
        for (let g = 0; g < groupBatches.length; g += parallelGroupBatches) {
          const parallelGroup = groupBatches.slice(g, g + parallelGroupBatches);

          const parallelResults = await Promise.allSettled(
            parallelGroup.map(batch => this.sentiment.groupSimilarItems(batch))
          );

          for (const result of parallelResults) {
            if (result.status === 'fulfilled') {
              allGroups.push(...result.value);
            } else {
              this.logger.error('Feedback', 'Grouping batch failed:', result.reason);
            }
          }

          groupedCount = Math.min(groupedCount + parallelGroupBatches * groupBatchSize, analyzedItems.length);
          this.syncStatus.set({ step: 'grouping', message: `Agrupando ${groupedCount} de ${analyzedItems.length} itens...` });
          this.logger.debug('Feedback', `Grouped ${groupedCount}/${analyzedItems.length} items`);
        }

        // Consolidate similar groups from different batches
        this.logger.info('Feedback', `Consolidating ${allGroups.length} groups...`);
        const consolidatedGroups = await this.sentiment.consolidateSimilarGroups(allGroups);

        for (const group of consolidatedGroups) {
          const groupIdSet = new Set(group.itemIds);
          this.items.update(allItems =>
            allItems.map(item =>
              groupIdSet.has(item.id) ? { ...item, groupId: group.id } : item
            )
          );
          this.addGroup(group);
        }

        // Save groups to Firebase
        if (consolidatedGroups.length > 0) {
          await this.sharedFeedback.saveGroups(consolidatedGroups);
          // Also update items with groupId in Firebase
          const itemsWithGroups = this.items().filter(i => i.groupId);
          await this.sharedFeedback.saveItems(itemsWithGroups);
        }

        this.logger.info('Feedback', `Created ${consolidatedGroups.length} consolidated feedback groups.`);
      }

      // Save sync state for incremental fetching (use max publishedAt for each source type)
      const now = new Date();
      const twitterItems = this.items().filter(i => i.sourceType === 'twitter-search');
      const issueItems = this.items().filter(i => i.sourceType === 'github-issue');
      const discussionItems = this.items().filter(i => i.sourceType === 'github-discussion');
      const discourseItems = this.items().filter(i => i.sourceType === 'discourse');

      const maxDate = (items: FeedbackItem[]) =>
        items.length > 0 ? new Date(Math.max(...items.map(i => i.publishedAt.getTime()))) : null;

      await this.sharedFeedback.saveSyncState({
        twitter: maxDate(twitterItems),
        githubIssues: maxDate(issueItems),
        githubDiscussions: maxDate(discussionItems),
        discourse: maxDate(discourseItems),
        lastSync: now,
      });
      this.logger.info('Feedback', 'Saved sync state for incremental fetching');
    } catch (error) {
      this.logger.error('Feedback', 'Analysis failed:', error);
    } finally {
      this.isLoading.set(false);
      this.syncStatus.set(null);
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
   * Toggle sentiment filter
   */
  toggleSentiment(sentiment: Sentiment): void {
    this.enabledSentiments.update(current => {
      const updated = new Set(current);
      if (updated.has(sentiment)) {
        updated.delete(sentiment);
      } else {
        updated.add(sentiment);
      }
      return updated;
    });
  }

  /**
   * Toggle category filter
   */
  toggleCategory(category: FeedbackCategory): void {
    this.enabledCategories.update(current => {
      const updated = new Set(current);
      if (updated.has(category)) {
        updated.delete(category);
      } else {
        updated.add(category);
      }
      return updated;
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
  /**
   * Get items for a specific group
   */
  getGroupItems(groupId: string): FeedbackItem[] {
    return this.items().filter(item => item.groupId === groupId);
  }

  // ============================================================
  // Cache Management (Admin Only)
  // ============================================================

  /**
   * Delete selected items from Firestore cache
   */
  async deleteSelectedFromCache(): Promise<number> {
    const selected = this.selectedItems();
    if (selected.length === 0) return 0;

    const ids = selected.map(item => item.id);
    await this.sharedFeedback.deleteItems(ids);

    // Remove from local state
    this.items.update(items => items.filter(item => !item.selected));
    this.logger.info('Feedback', `Deleted ${ids.length} items from cache`);

    return ids.length;
  }

  /**
   * Clear ALL cached data from Firestore (items + groups)
   */
  async clearAllCache(): Promise<void> {
    await this.sharedFeedback.clearAllItems();

    // Clear local state
    this.items.set([]);
    this.groups.set([]);
    this.logger.info('Feedback', 'Cleared all cached data');
  }
}
