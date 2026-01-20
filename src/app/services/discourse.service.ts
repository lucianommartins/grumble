import { Injectable, inject, signal } from '@angular/core';
import { FeedbackItem, DiscourseConfig, DEFAULT_DISCOURSE } from '../models/feedback.model';
import { LoggerService } from './logger.service';

interface DiscourseTopic {
  id: number;
  title: string;
  slug: string;
  posts_count: number;
  reply_count: number;
  like_count: number;
  views: number;
  created_at: string;
  last_posted_at: string;
  category_id: number;
  posters: { user_id: number; description: string }[];
}

interface DiscoursePost {
  id: number;
  topic_id: number;
  post_number: number;
  cooked: string;           // HTML content
  raw?: string;             // Raw markdown (if available)
  username: string;
  avatar_template: string;
  created_at: string;
  updated_at: string;
  reply_count: number;
  like_count: number;
  reply_to_post_number: number | null;
}

interface DiscourseLatestResponse {
  topic_list: {
    topics: DiscourseTopic[];
  };
  users: { id: number; username: string; avatar_template: string }[];
}

interface DiscourseTopicResponse {
  title: string;
  post_stream: {
    posts: DiscoursePost[];
  };
  details: {
    created_by: { username: string; avatar_template: string };
  };
}

const CORS_PROXY = 'https://corsproxy.io/?';

@Injectable({
  providedIn: 'root'
})
export class DiscourseService {
  private logger = inject(LoggerService);

  // Configuration
  configs = signal<DiscourseConfig[]>([]);

  constructor() {
    this.initializeDefaultConfigs();
  }

  private initializeDefaultConfigs(): void {
    const defaultConfigs: DiscourseConfig[] = DEFAULT_DISCOURSE.map((config, index) => ({
      ...config,
      id: `discourse-${index}`,
      createdAt: new Date()
    }));
    this.configs.set(defaultConfigs);
  }

  /**
   * Fetch latest topics from a Discourse forum
   * @param since - Optional date to fetch only topics newer than this
   */
  async fetchLatestTopics(baseUrl: string, limit: number = 30, since?: Date): Promise<FeedbackItem[]> {
    const url = `${CORS_PROXY}${encodeURIComponent(`${baseUrl}/latest.json?per_page=${limit}`)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Discourse API error: ${response.status}`);
      }

      const data: DiscourseLatestResponse = await response.json();
      const topics = data.topic_list?.topics || [];
      const users = data.users || [];

      // Create user map for avatar lookup
      const userMap = new Map(users.map(u => [u.id, u]));

      // Client-side filter by date if 'since' is provided
      const filtered = since
        ? topics.filter(t => new Date(t.created_at) > since)
        : topics;

      this.logger.debug('Discourse', `Fetched ${filtered.length} topics from ${baseUrl}${since ? ' (incremental)' : ''}`);

      return filtered.map(topic => this.mapTopicToFeedback(topic, baseUrl, userMap));
    } catch (error) {
      this.logger.error('Discourse', `Failed to fetch topics from ${baseUrl}:`, error);
      return [];
    }
  }

  /**
   * Fetch posts (including replies) from a specific topic
   */
  async fetchTopicPosts(baseUrl: string, topicId: number, topicSlug: string): Promise<FeedbackItem[]> {
    const url = `${CORS_PROXY}${encodeURIComponent(`${baseUrl}/t/${topicSlug}/${topicId}.json`)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Discourse topic fetch error: ${response.status}`);
      }

      const data: DiscourseTopicResponse = await response.json();
      const posts = data.post_stream?.posts || [];
      const topicTitle = data.title;

      this.logger.debug('Discourse', `Fetched ${posts.length} posts from topic ${topicId}`);

      return posts.map(post => this.mapPostToFeedback(post, baseUrl, topicId, topicTitle));
    } catch (error) {
      this.logger.error('Discourse', `Failed to fetch posts from topic ${topicId}:`, error);
      return [];
    }
  }

  /**
   * Fetch recent topics and their replies from all configured forums
   * @param since - Optional date to fetch only items newer than this
   */
  async fetchAllForums(includeReplies: boolean = true, since?: Date): Promise<FeedbackItem[]> {
    const enabledConfigs = this.configs().filter(c => c.enabled);
    const allItems: FeedbackItem[] = [];

    for (const config of enabledConfigs) {
      // Fetch latest topics
      const topics = await this.fetchLatestTopics(config.baseUrl, 30, since);
      allItems.push(...topics);

      // Optionally fetch replies for each topic (limited to avoid rate limits)
      if (includeReplies) {
        const topicsToFetch = topics.slice(0, 10); // Limit to 10 most recent
        for (const topic of topicsToFetch) {
          // Extract topic ID and slug from the URL
          const match = topic.url.match(/\/t\/([^/]+)\/(\d+)/);
          if (match) {
            const [, slug, id] = match;
            const posts = await this.fetchTopicPosts(config.baseUrl, parseInt(id), slug);
            // Add only replies (skip first post which is the topic itself)
            allItems.push(...posts.filter(p => p.isReply));
          }
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }

    this.logger.info('Discourse', `Total items fetched: ${allItems.length}`);
    return allItems;
  }

  /**
   * Strip HTML tags and decode entities
   */
  private stripHtml(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  }

  /**
   * Build avatar URL from template
   */
  private buildAvatarUrl(baseUrl: string, template: string, size: number = 45): string {
    if (!template) return '';
    const avatarPath = template.replace('{size}', size.toString());
    return avatarPath.startsWith('http') ? avatarPath : `${baseUrl}${avatarPath}`;
  }

  private mapTopicToFeedback(
    topic: DiscourseTopic,
    baseUrl: string,
    userMap: Map<number, { username: string; avatar_template: string }>
  ): FeedbackItem {
    // Get author info from first poster
    const firstPoster = topic.posters?.find(p => p.description.includes('Original Poster'));
    const author = firstPoster ? userMap.get(firstPoster.user_id) : undefined;

    return {
      id: `discourse-topic-${topic.id}`,
      sourceType: 'discourse',
      sourceId: topic.id.toString(),
      sourceName: new URL(baseUrl).hostname,
      title: topic.title,
      content: topic.title, // Full content requires fetching the topic
      author: author?.username || 'unknown',
      authorHandle: author?.username,
      authorAvatar: author ? this.buildAvatarUrl(baseUrl, author.avatar_template) : undefined,
      publishedAt: new Date(topic.created_at),
      url: `${baseUrl}/t/${topic.slug}/${topic.id}`,
      replyCount: topic.reply_count,
      reactionCount: topic.like_count,
      isReply: false,
      selected: false,
      analyzed: false,
      dismissed: false,
    };
  }

  private mapPostToFeedback(
    post: DiscoursePost,
    baseUrl: string,
    topicId: number,
    topicTitle: string
  ): FeedbackItem {
    return {
      id: `discourse-post-${post.id}`,
      sourceType: 'discourse',
      sourceId: post.id.toString(),
      sourceName: new URL(baseUrl).hostname,
      title: topicTitle,
      content: this.stripHtml(post.cooked),
      author: post.username,
      authorHandle: post.username,
      authorAvatar: this.buildAvatarUrl(baseUrl, post.avatar_template),
      publishedAt: new Date(post.created_at),
      url: `${baseUrl}/t/-/${topicId}/${post.post_number}`,
      replyCount: post.reply_count,
      reactionCount: post.like_count,
      isReply: post.post_number > 1,
      parentId: post.reply_to_post_number ? `discourse-post-${post.reply_to_post_number}` : undefined,
      selected: false,
      analyzed: false,
      dismissed: false,
    };
  }

  /**
   * Add a new forum to monitor
   */
  addForum(baseUrl: string): DiscourseConfig {
    const config: DiscourseConfig = {
      id: `discourse-${Date.now()}`,
      baseUrl: baseUrl.replace(/\/$/, ''), // Remove trailing slash
      enabled: true,
      categories: 'all',
      createdAt: new Date(),
    };
    this.configs.update(configs => [...configs, config]);
    return config;
  }

  /**
   * Remove a forum from monitoring
   */
  removeForum(id: string): void {
    this.configs.update(configs => configs.filter(c => c.id !== id));
  }

  /**
   * Toggle forum enabled state
   */
  toggleForum(id: string): void {
    this.configs.update(configs =>
      configs.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c)
    );
  }
}
