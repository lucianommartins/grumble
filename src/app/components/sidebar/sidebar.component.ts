import { Component, inject, signal, computed, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeedService } from '../../services/feed.service';
import { SyncService } from '../../services/sync.service';
import { UserSettingsService } from '../../services/user-settings.service';
import { I18nService } from '../../i18n';
import { Feed } from '../../models/feed.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
  feedService = inject(FeedService);
  syncService = inject(SyncService);
  userSettings = inject(UserSettingsService);
  i18n = inject(I18nService);
  common = this.i18n.t.common;

  @Output() openSettings = new EventEmitter<void>();

  showAddForm = signal(false);
  editingFeedId = signal<string | null>(null);
  newFeedName = signal('');
  newFeedUrl = signal('');
  newFeedType = signal<Feed['type']>('twitter');

  get feeds() {
    // Sort feeds: first by type (alphabetically), then by name (alphabetically)
    return computed(() => {
      return [...this.feedService.feeds()].sort((a, b) => {
        const typeCompare = a.type.localeCompare(b.type);
        if (typeCompare !== 0) return typeCompare;
        return a.name.localeCompare(b.name);
      });
    });
  }

  get timeWindow() {
    return this.syncService.timeWindowHours;
  }

  get isLoading() {
    return this.syncService.isLoading;
  }

  onTimeWindowChange(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.syncService.setTimeWindow(value);
  }

  getTimeWindowLabel(): string {
    const hours = this.timeWindow();
    if (hours < 24) {
      return `${hours}h`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  async onSync(): Promise<void> {
    // Check if Gemini API key is configured
    if (!this.userSettings.hasGeminiApiKey()) {
      this.openSettings.emit();
      return;
    }
    await this.syncService.syncAll();
  }

  toggleFeed(id: string): void {
    this.feedService.toggleFeed(id);
  }

  removeFeed(id: string): void {
    this.feedService.removeFeed(id);
  }

  /**
   * Enable only this feed (solo mode)
   */
  soloFeed(id: string): void {
    this.feedService.soloFeed(id);
  }

  getFeedIcon(type: Feed['type']): string {
    switch (type) {
      case 'twitter':
        return '𝕏';
      case 'rss':
        return '📡';
      case 'blog':
        return '📝';
      case 'youtube':
        return '▶️';
      default:
        return '📄';
    }
  }

  getFeedIconClass(type: Feed['type']): string {
    switch (type) {
      case 'twitter':
        return 'icon-twitter';
      case 'rss':
        return 'icon-rss';
      case 'blog':
        return 'icon-blog';
      case 'youtube':
        return 'icon-youtube';
      default:
        return '';
    }
  }

  openAddForm(): void {
    this.showAddForm.set(true);
    this.editingFeedId.set(null);
    this.newFeedName.set('');
    this.newFeedUrl.set('');
    // Default to twitter if bearer token exists, otherwise blog
    this.newFeedType.set(this.userSettings.hasTwitterBearerToken() ? 'twitter' : 'blog');
  }

  editFeed(feed: Feed): void {
    this.showAddForm.set(true);
    this.editingFeedId.set(feed.id);
    this.newFeedName.set(feed.name);
    this.newFeedUrl.set(feed.url);
    this.newFeedType.set(feed.type);
  }

  cancelAddForm(): void {
    this.showAddForm.set(false);
    this.editingFeedId.set(null);
    this.newFeedName.set('');
    this.newFeedUrl.set('');
    this.newFeedType.set('rss');
  }

  updateUrl(url: string): void {
    this.newFeedUrl.set(url);
    this.newFeedType.set(this.detectFeedType(url));
  }

  detectFeedType(input: string): Feed['type'] {
    const trimmed = input.trim().toLowerCase();

    // Twitter: only by domain (not @ since other social networks use it too)
    if (trimmed.includes('twitter.com') || trimmed.includes('x.com')) {
      return 'twitter';
    }

    // RSS: Common RSS feed patterns
    if (trimmed.endsWith('/feed') || trimmed.endsWith('/feed/')) {
      return 'rss';
    }
    if (trimmed.endsWith('/rss') || trimmed.endsWith('/rss/')) {
      return 'rss';
    }
    if (trimmed.endsWith('.xml') || trimmed.endsWith('.rss')) {
      return 'rss';
    }
    if (trimmed.includes('/feed/') || trimmed.includes('/rss/')) {
      return 'rss';
    }
    if (trimmed.includes('medium.com/feed/')) {
      return 'rss';
    }
    if (trimmed.includes('feeds.feedburner.com')) {
      return 'rss';
    }

    // YouTube: channel ID (starts with UC) or youtube.com URL
    if (trimmed.startsWith('uc') && trimmed.length >= 20) {
      return 'youtube';
    }
    if (trimmed.includes('youtube.com/channel/')) {
      return 'youtube';
    }

    // Default to blog (scraping)
    return 'blog';
  }

  saveFeed(): void {
    if (!this.newFeedName() || !this.newFeedUrl()) return;

    const editId = this.editingFeedId();
    if (editId) {
      // Update existing feed
      this.feedService.updateFeed(editId, {
        name: this.newFeedName(),
        url: this.newFeedUrl(),
        type: this.newFeedType()
      });
    } else {
      // Add new feed (returns null if duplicate)
      const result = this.feedService.addFeed({
        name: this.newFeedName(),
        url: this.newFeedUrl(),
        type: this.newFeedType(),
        enabled: true
      });

      if (!result) {
        alert(this.i18n.t.sidebar?.duplicateError || 'A source with this URL already exists.');
        return;
      }
    }

    this.cancelAddForm();
  }
}
