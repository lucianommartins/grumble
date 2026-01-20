import { Component, inject, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeedbackService } from '../../services/feedback.service';
import { TwitterSearchService } from '../../services/twitter-search.service';
import { GitHubService } from '../../services/github.service';
import { UserSettingsService } from '../../services/user-settings.service';
import { FeedbackSourceType, Sentiment } from '../../models/feedback.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
  feedbackService = inject(FeedbackService);
  twitterService = inject(TwitterSearchService);
  githubService = inject(GitHubService);
  userSettings = inject(UserSettingsService);

  @Output() openSettings = new EventEmitter<void>();

  showAddKeyword = signal(false);
  newKeyword = '';
  selectedGroup = signal<string | null>(null);

  get stats() {
    return this.feedbackService.stats;
  }

  isSourceEnabled(type: FeedbackSourceType): boolean {
    return this.feedbackService.enabledSourceTypes().has(type);
  }

  toggleSource(type: FeedbackSourceType): void {
    this.feedbackService.toggleSourceType(type);
  }

  async onSync(): Promise<void> {
    // Check if Gemini API key is configured
    if (!this.userSettings.hasGeminiApiKey()) {
      this.openSettings.emit();
      return;
    }
    await this.feedbackService.syncAll();
  }

  addKeyword(): void {
    if (!this.newKeyword.trim()) return;
    this.twitterService.addKeyword(this.newKeyword.trim());
    this.newKeyword = '';
    this.showAddKeyword.set(false);
  }

  filterByGroup(groupId: string): void {
    if (this.selectedGroup() === groupId) {
      this.clearGroupFilter();
    } else {
      this.selectedGroup.set(groupId);
      this.feedbackService.filterByGroup(groupId);
    }
  }

  clearGroupFilter(): void {
    this.selectedGroup.set(null);
    this.feedbackService.clearGroupFilter();
  }

  getSentimentIcon(sentiment: Sentiment): string {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'neutral': return '😐';
      case 'negative': return '😤';
      default: return '❓';
    }
  }
}
