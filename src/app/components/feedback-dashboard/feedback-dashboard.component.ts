import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeedbackService } from '../../services/feedback.service';
import { SentimentService } from '../../services/sentiment.service';
import { ThemeService } from '../../services/theme.service';
import { FeedbackItem, Sentiment, FeedbackCategory, SENTIMENT_COLORS, CATEGORY_LABELS, FeedbackSourceType } from '../../models/feedback.model';
import { I18nService } from '../../i18n';
import { SkeletonItemComponent } from '../skeleton-item/skeleton-item.component';

@Component({
  selector: 'app-feedback-dashboard',
  standalone: true,
  imports: [CommonModule, SkeletonItemComponent],
  templateUrl: './feedback-dashboard.component.html',
  styleUrl: './feedback-dashboard.component.css'
})
export class FeedbackDashboardComponent {
  feedbackService = inject(FeedbackService);
  sentimentService = inject(SentimentService);
  themeService = inject(ThemeService);
  i18n = inject(I18nService);

  viewMode = signal<'cards' | 'list'>('list');
  isAnalyzing = signal(false);

  // Get filtered items from service
  get items() {
    return this.feedbackService.filteredItems;
  }

  get isLoading() {
    return this.feedbackService.isLoading;
  }

  get stats() {
    return this.feedbackService.stats;
  }

  get selectedCount() {
    return this.feedbackService.selectedCount;
  }

  // Source type filter state
  sourceFilters = computed(() => {
    const enabled = this.feedbackService.enabledSourceTypes();
    return [
      { type: 'twitter-search' as FeedbackSourceType, label: '𝕏 Twitter', enabled: enabled.has('twitter-search') },
      { type: 'github-issue' as FeedbackSourceType, label: '🐙 Issues', enabled: enabled.has('github-issue') },
      { type: 'github-discussion' as FeedbackSourceType, label: '💬 Discussions', enabled: enabled.has('github-discussion') },
      { type: 'discourse' as FeedbackSourceType, label: '🗣️ Forum', enabled: enabled.has('discourse') },
    ];
  });

  // Sentiment filter
  selectedSentiment = this.feedbackService.selectedSentiment;

  toggleItem(item: FeedbackItem): void {
    this.feedbackService.toggleSelection(item.id);
  }

  selectAll(): void {
    this.feedbackService.selectAll(true);
  }

  deselectAll(): void {
    this.feedbackService.selectAll(false);
  }

  toggleViewMode(): void {
    this.viewMode.set(this.viewMode() === 'cards' ? 'list' : 'cards');
  }

  toggleSourceType(type: FeedbackSourceType): void {
    this.feedbackService.toggleSourceType(type);
  }

  setSentimentFilter(sentiment: Sentiment | null): void {
    this.feedbackService.selectedSentiment.set(sentiment);
  }

  dismissItem(item: FeedbackItem, event: Event): void {
    event.stopPropagation();
    this.feedbackService.dismissItem(item.id);
  }

  async analyzeSelected(): Promise<void> {
    const selected = this.feedbackService.selectedItems();
    if (selected.length === 0) return;

    this.isAnalyzing.set(true);
    try {
      const results = await this.sentimentService.analyzeBatch(selected);

      // Update items with analysis results
      for (const [id, analysis] of results) {
        this.feedbackService.updateItemAnalysis(id, {
          sentiment: analysis.sentiment,
          sentimentConfidence: analysis.sentimentConfidence,
          category: analysis.category,
          categoryConfidence: analysis.categoryConfidence,
        });
      }
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  async syncSources(): Promise<void> {
    await this.feedbackService.syncAll();
  }

  formatDate(date: Date): string {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    if (diff < 60000) return 'now';
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins}m`;
    }
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h`;
    }
    const days = Math.floor(diff / 86400000);
    return `${days}d`;
  }

  getSourceIcon(type: FeedbackSourceType): string {
    switch (type) {
      case 'twitter-search': return '𝕏';
      case 'github-issue': return '🐛';
      case 'github-discussion': return '💬';
      case 'discourse': return '🗣️';
      default: return '📄';
    }
  }

  getSentimentClass(sentiment?: Sentiment): string {
    if (!sentiment) return '';
    return `sentiment-${sentiment}`;
  }

  getSentimentIcon(sentiment?: Sentiment): string {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'neutral': return '😐';
      case 'negative': return '😤';
      default: return '';
    }
  }

  getCategoryLabel(category?: FeedbackCategory): { icon: string; label: string } {
    if (!category) return { icon: '', label: '' };
    return CATEGORY_LABELS[category] || { icon: '📝', label: 'Other' };
  }

  truncateContent(content: string, maxLength: number = 200): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + '...';
  }

  openUrl(url: string, event: Event): void {
    event.stopPropagation();
    window.open(url, '_blank', 'noopener');
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }
}
