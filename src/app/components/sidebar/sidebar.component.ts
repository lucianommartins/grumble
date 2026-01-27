import { Component, inject, signal, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeedbackService } from '../../services/feedback.service';
import { TwitterSearchService } from '../../services/twitter-search.service';
import { GitHubService } from '../../services/github.service';
import { UserSettingsService } from '../../services/user-settings.service';
import { FeedbackSourceType, Sentiment } from '../../models/feedback.model';
import { I18nService } from '../../i18n';
import { AuthService } from '../../services/auth.service';

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
  i18n = inject(I18nService);
  authService = inject(AuthService);

  @Output() openSettings = new EventEmitter<void>();

  showAddKeyword = signal(false);
  showAddRepo = signal(false);
  newKeyword = '';
  newRepoUrl = '';
  repoError = signal<string | null>(null);
  isValidatingRepo = signal(false);
  selectedGroup = signal<string | null>(null);
  selectedGroupSentiment = signal<Sentiment | null>(null);

  // Admin check for showing add buttons
  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  // Groups filtered by sentiment, with itemCount recalculated based on available items
  filteredSortedGroups = computed(() => {
    const sentiment = this.selectedGroupSentiment();
    const allItems = this.feedbackService.items();
    const itemIds = new Set(allItems.map(i => i.id));

    // Recalculate itemCount based on items that actually exist
    let groups = this.feedbackService.groups().map(g => {
      const visibleCount = (g.itemIds || []).filter(id => itemIds.has(id)).length;
      return { ...g, itemCount: visibleCount };
    });

    // Filter out groups with no visible items
    groups = groups.filter(g => g.itemCount > 0);

    if (sentiment) {
      groups = groups.filter(g => g.sentiment === sentiment);
    }

    return groups.sort((a, b) => b.itemCount - a.itemCount);
  });

  // Legacy computed for backward compatibility
  sortedGroups = computed(() =>
    [...this.feedbackService.groups()].sort((a, b) => b.itemCount - a.itemCount)
  );

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

  /**
   * Add a GitHub repo from URL
   * Accepts formats: https://github.com/owner/repo or owner/repo
   */
  async addRepo(): Promise<void> {
    const url = this.newRepoUrl.trim();
    if (!url) return;

    // Parse owner/repo from URL
    let owner = '';
    let repo = '';

    // Try URL format first
    const urlMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
    if (urlMatch) {
      owner = urlMatch[1];
      repo = urlMatch[2].replace(/\.git$/, '');
    } else {
      // Try owner/repo format
      const slashMatch = url.match(/^([^\/]+)\/([^\/]+)$/);
      if (slashMatch) {
        owner = slashMatch[1];
        repo = slashMatch[2];
      }
    }

    if (!owner || !repo) {
      this.repoError.set('Invalid format. Use https://github.com/owner/repo or owner/repo');
      return;
    }

    // Validate repo exists via GitHub API
    this.isValidatingRepo.set(true);
    this.repoError.set(null);

    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
      if (!response.ok) {
        if (response.status === 404) {
          this.repoError.set(`Repository ${owner}/${repo} not found`);
        } else {
          this.repoError.set(`Failed to validate: ${response.statusText}`);
        }
        return;
      }

      // Repo exists, add it
      this.githubService.addRepo(owner, repo);
      this.newRepoUrl = '';
      this.showAddRepo.set(false);
      this.repoError.set(null);
    } catch (error) {
      this.repoError.set('Network error. Please try again.');
    } finally {
      this.isValidatingRepo.set(false);
    }
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
