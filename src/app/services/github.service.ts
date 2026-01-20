import { Injectable, inject, signal } from '@angular/core';
import { FeedbackItem, GitHubRepoConfig, DEFAULT_GITHUB_REPOS } from '../models/feedback.model';
import { UserSettingsService } from './user-settings.service';
import { LoggerService } from './logger.service';
import { RetryService } from './retry.service';

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  user: { login: string; avatar_url: string } | null;
  created_at: string;
  updated_at: string;
  state: 'open' | 'closed';
  labels: { name: string }[];
  comments: number;
  reactions?: { total_count: number };
}

interface GitHubDiscussion {
  id: string;
  number: number;
  title: string;
  body: string;
  url: string;
  author: { login: string; avatarUrl: string } | null;
  createdAt: string;
  category: { name: string };
  comments: { totalCount: number };
  upvoteCount: number;
}

interface GitHubGraphQLResponse {
  data?: {
    repository?: {
      discussions?: {
        nodes: GitHubDiscussion[];
      };
    };
  };
  errors?: { message: string }[];
}

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_GRAPHQL = 'https://api.github.com/graphql';

@Injectable({
  providedIn: 'root'
})
export class GitHubService {
  private userSettings = inject(UserSettingsService);
  private logger = inject(LoggerService);
  private retry = inject(RetryService);

  // Configuration
  repos = signal<GitHubRepoConfig[]>([]);

  constructor() {
    this.initializeDefaultRepos();
  }

  private initializeDefaultRepos(): void {
    const defaultConfigs: GitHubRepoConfig[] = DEFAULT_GITHUB_REPOS.map((repo) => ({
      ...repo,
      id: `github-${repo.owner}-${repo.repo}`,
      createdAt: new Date()
    }));
    this.repos.set(defaultConfigs);
  }

  /**
   * Fetch issues from a GitHub repository
   */
  async fetchIssues(owner: string, repo: string, since?: Date): Promise<FeedbackItem[]> {
    const pat = this.userSettings.getGithubPat();

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
    };
    if (pat) {
      headers['Authorization'] = `Bearer ${pat}`;
    }

    const params = new URLSearchParams({
      state: 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: '50',
    });
    if (since) {
      params.set('since', since.toISOString());
    }

    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues?${params}`;

    try {
      const response = await this.retry.withRetry(async () => {
        const res = await fetch(url, { headers });
        if (!res.ok) {
          throw new Error(`GitHub API error: ${res.status}`);
        }
        return res;
      }, {}, `GitHub Issues ${owner}/${repo}`);

      const issues: GitHubIssue[] = await response.json();

      // Filter out pull requests (they also appear in /issues endpoint)
      const actualIssues = issues.filter(issue => !('pull_request' in issue));

      this.logger.debug('GitHub', `Fetched ${actualIssues.length} issues from ${owner}/${repo}`);

      return actualIssues.map(issue => this.mapIssueToFeedback(issue, owner, repo));
    } catch (error) {
      this.logger.error('GitHub', `Failed to fetch issues from ${owner}/${repo}:`, error);
      return [];
    }
  }

  /**
   * Fetch discussions from a GitHub repository using GraphQL API
   */
  async fetchDiscussions(owner: string, repo: string, limit: number = 50): Promise<FeedbackItem[]> {
    const pat = this.userSettings.getGithubPat();

    if (!pat) {
      this.logger.warn('GitHub', 'PAT required for Discussions API');
      return [];
    }

    const query = `
      query($owner: String!, $repo: String!, $first: Int!) {
        repository(owner: $owner, name: $repo) {
          discussions(first: $first, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes {
              id
              number
              title
              body
              url
              author { login avatarUrl }
              createdAt
              category { name }
              comments { totalCount }
              upvoteCount
            }
          }
        }
      }
    `;

    try {
      const response = await this.retry.withRetry(async () => {
        const res = await fetch(GITHUB_GRAPHQL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${pat}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            variables: { owner, repo, first: limit }
          })
        });

        if (!res.ok) {
          throw new Error(`GitHub GraphQL error: ${res.status}`);
        }
        return res;
      }, {}, `GitHub Discussions ${owner}/${repo}`);

      const result: GitHubGraphQLResponse = await response.json();

      if (result.errors) {
        this.logger.error('GitHub', 'GraphQL errors:', result.errors);
        return [];
      }

      const discussions = result.data?.repository?.discussions?.nodes || [];
      this.logger.debug('GitHub', `Fetched ${discussions.length} discussions from ${owner}/${repo}`);

      return discussions.map(disc => this.mapDiscussionToFeedback(disc, owner, repo));
    } catch (error) {
      this.logger.error('GitHub', `Failed to fetch discussions from ${owner}/${repo}:`, error);
      return [];
    }
  }

  /**
   * Fetch all content from configured repositories
   */
  async fetchAllRepos(since?: Date): Promise<FeedbackItem[]> {
    const enabledRepos = this.repos().filter(r => r.enabled);
    const allItems: FeedbackItem[] = [];

    await Promise.allSettled(
      enabledRepos.map(async (config) => {
        if (config.includeIssues) {
          const issues = await this.fetchIssues(config.owner, config.repo, since);
          allItems.push(...issues);
        }
        if (config.includeDiscussions) {
          const discussions = await this.fetchDiscussions(config.owner, config.repo);
          allItems.push(...discussions);
        }
      })
    );

    this.logger.info('GitHub', `Total items fetched: ${allItems.length}`);
    return allItems;
  }

  private mapIssueToFeedback(issue: GitHubIssue, owner: string, repo: string): FeedbackItem {
    return {
      id: `github-issue-${owner}-${repo}-${issue.number}`,
      sourceType: 'github-issue',
      sourceId: issue.id.toString(),
      sourceName: repo,
      title: issue.title,
      content: issue.body || '',
      author: issue.user?.login || 'unknown',
      authorHandle: issue.user?.login,
      authorAvatar: issue.user?.avatar_url,
      publishedAt: new Date(issue.created_at),
      url: issue.html_url,
      replyCount: issue.comments,
      reactionCount: issue.reactions?.total_count || 0,
      labels: issue.labels.map(l => l.name),
      state: issue.state,
      repo: `${owner}/${repo}`,
      selected: false,
      analyzed: false,
      dismissed: false,
    };
  }

  private mapDiscussionToFeedback(disc: GitHubDiscussion, owner: string, repo: string): FeedbackItem {
    return {
      id: `github-discussion-${owner}-${repo}-${disc.number}`,
      sourceType: 'github-discussion',
      sourceId: disc.id,
      sourceName: repo,
      title: disc.title,
      content: disc.body,
      author: disc.author?.login || 'unknown',
      authorHandle: disc.author?.login,
      authorAvatar: disc.author?.avatarUrl,
      publishedAt: new Date(disc.createdAt),
      url: disc.url,
      replyCount: disc.comments.totalCount,
      reactionCount: disc.upvoteCount,
      repo: `${owner}/${repo}`,
      selected: false,
      analyzed: false,
      dismissed: false,
    };
  }

  /**
   * Add a new repository to monitor
   */
  addRepo(owner: string, repo: string): GitHubRepoConfig {
    const config: GitHubRepoConfig = {
      id: `github-${owner}-${repo}`,
      owner,
      repo,
      enabled: true,
      includeIssues: true,
      includeDiscussions: true,
      createdAt: new Date(),
    };
    this.repos.update(repos => [...repos, config]);
    return config;
  }

  /**
   * Remove a repository from monitoring
   */
  removeRepo(id: string): void {
    this.repos.update(repos => repos.filter(r => r.id !== id));
  }

  /**
   * Toggle repository enabled state
   */
  toggleRepo(id: string): void {
    this.repos.update(repos =>
      repos.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
    );
  }
}
