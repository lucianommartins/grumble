import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SyncService } from '../../services/sync.service';
import { FeedService } from '../../services/feed.service';
import { ThemeService } from '../../services/theme.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { FeedItem } from '../../models/feed.model';
import { I18nService } from '../../i18n';
import { SkeletonItemComponent } from '../skeleton-item/skeleton-item.component';
import { LazyImageDirective } from '../../directives/lazy-image.directive';

@Component({
  selector: 'app-feed-dashboard',
  standalone: true,
  imports: [CommonModule, SkeletonItemComponent, LazyImageDirective],
  templateUrl: './feed-dashboard.component.html',
  styleUrl: './feed-dashboard.component.css'
})
export class FeedDashboardComponent {
  syncService = inject(SyncService);
  feedService = inject(FeedService);
  themeService = inject(ThemeService);
  confirmDialog = inject(ConfirmDialogService);
  i18n = inject(I18nService);
  viewMode = signal<'cards' | 'list'>('list');
  sortBy = signal<'date' | 'source'>('date');
  hideUsed = signal(false);

  get items() {
    return this.syncService.items;
  }

  // Filtered and sorted items based on enabled sources
  sortedItems = computed(() => {
    // Get enabled feed IDs and types
    const enabledFeeds = this.feedService.feeds().filter(f => f.enabled);
    const enabledFeedIds = new Set(enabledFeeds.map(f => f.id));
    const enabledTypes = this.feedService.enabledTypes();

    // Filter items by enabled feeds and enabled types
    let items = this.items().filter(item =>
      enabledFeedIds.has(item.feedId) && enabledTypes.has(item.feedType)
    );

    // Filter out used items if hideUsed is enabled
    if (this.hideUsed()) {
      items = items.filter(item => !item.used);
    }

    // Apply sorting
    if (this.sortBy() === 'date') {
      return items.sort((a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    } else {
      // Sort by source name, then by date within same source
      return items.sort((a, b) => {
        const sourceCompare = a.feedName.localeCompare(b.feedName);
        if (sourceCompare !== 0) return sourceCompare;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });
    }
  });

  get isLoading() {
    return this.syncService.isLoading;
  }

  get error() {
    return this.syncService.error;
  }

  get selectedCount() {
    return this.syncService.selectedCount;
  }

  toggleItem(item: FeedItem): void {
    this.syncService.toggleSelection(item.id);
  }

  selectAll(): void {
    this.syncService.selectAll();
  }

  deselectAll(): void {
    this.syncService.deselectAll();
  }

  toggleViewMode(): void {
    this.viewMode.set(this.viewMode() === 'cards' ? 'list' : 'cards');
  }

  formatDate(date: Date): string {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    if (diff < 60000) {
      return this.i18n.t.feed.justNow || 'now';
    }
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins} ${this.i18n.t.feed.minutesAgo}`;
    }
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} ${this.i18n.t.feed.hoursAgo}`;
    }
    // Always use relative time for consistency
    const days = Math.floor(diff / 86400000);
    return `${days} ${this.i18n.t.feed.daysAgo || 'd ago'}`;
  }

  getFeedTypeIcon(type: string): string {
    switch (type) {
      case 'twitter':
        return '𝕏';
      case 'rss':
        return '📡';
      case 'blog':
        return '📝';
      default:
        return '📄';
    }
  }

  truncateContent(content: string, maxLength: number = 200): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + '...';
  }

  openUrl(url: string): void {
    window.open(url, '_blank', 'noopener');
  }

  getSourceFeedsTooltip(item: FeedItem): string {
    if (!item.sourceFeeds || item.sourceFeeds.length <= 1) return '';
    return this.i18n.t.feed.alsoIn + ' ' + item.sourceFeeds.slice(1).map(sf => sf.name).join(', ');
  }

  markAsIrrelevant(item: FeedItem): void {
    this.syncService.markAsIrrelevant(item.id);
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  async deleteSelected(): Promise<void> {
    const selectedItems = this.syncService.selectedItems();
    if (selectedItems.length === 0) return;

    const message = this.i18n.t.feed.confirmDelete?.replace('{count}', selectedItems.length.toString())
      || `Delete ${selectedItems.length} selected items from cache?`;

    const confirmed = await this.confirmDialog.confirm({
      title: '🗑️ ' + (this.i18n.t.common.delete || 'Delete'),
      message,
      confirmText: this.i18n.t.common.delete || 'Delete',
      cancelText: this.i18n.t.common.cancel || 'Cancel',
      isDanger: true
    });

    if (confirmed) {
      await this.syncService.deleteItems(selectedItems.map(item => item.id));
    }
  }
}
