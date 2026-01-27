import { Injectable, inject, signal } from '@angular/core';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import {
  SearchKeyword,
  GitHubRepoConfig,
  DiscourseConfig,
  DEFAULT_KEYWORDS,
  DEFAULT_GITHUB_REPOS,
  DEFAULT_DISCOURSE
} from '../models/feedback.model';
import { LoggerService } from './logger.service';

/**
 * Source configurations stored in Firestore
 */
export interface SourceConfigs {
  twitter: {
    enabled: boolean;
    keywords: SearchKeyword[];
  };
  github: {
    enabled: boolean;
    repos: GitHubRepoConfig[];
  };
  discourse: {
    enabled: boolean;
    forums: DiscourseConfig[];
  };
}

/**
 * SourceConfigService manages source configurations in Firestore
 * Enables both webapp and sync-service to share the same config
 */
@Injectable({
  providedIn: 'root'
})
export class SourceConfigService {
  private firestore = inject(Firestore);
  private logger = inject(LoggerService);

  private readonly CONFIG_COLLECTION = 'config';

  // Local cache of configs - initialized with defaults for immediate UI
  twitterKeywords = signal<SearchKeyword[]>(this.createDefaultKeywords());
  githubRepos = signal<GitHubRepoConfig[]>(this.createDefaultGitHubRepos());
  discourseForums = signal<DiscourseConfig[]>(this.createDefaultDiscourseForums());

  private initialized = false;

  constructor() {
    // Load from Firestore in background to get latest config
    this.loadConfigs().catch(err => {
      console.error('[SourceConfig] Failed to load from Firestore, using defaults:', err);
    });
  }

  /**
   * Load all source configs from Firestore
   * If no config exists, initializes with defaults and saves them
   */
  async loadConfigs(): Promise<void> {
    if (this.initialized) return;

    console.log('[SourceConfig] Loading configs from Firestore...');

    try {
      // Load Twitter config
      const twitterConfig = await this.loadTwitterConfig();
      this.twitterKeywords.set(twitterConfig);

      // Load GitHub config
      const githubConfig = await this.loadGitHubConfig();
      this.githubRepos.set(githubConfig);

      // Load Discourse config
      const discourseConfig = await this.loadDiscourseConfig();
      this.discourseForums.set(discourseConfig);

      this.initialized = true;
      console.log(`[SourceConfig] Loaded: ${twitterConfig.length} keywords, ${githubConfig.length} repos, ${discourseConfig.length} forums`);
    } catch (error) {
      console.error('[SourceConfig] Error loading configs:', error);
      throw error;
    }
  }

  /**
   * Load Twitter keywords from Firestore
   */
  private async loadTwitterConfig(): Promise<SearchKeyword[]> {
    const docRef = doc(this.firestore, this.CONFIG_COLLECTION, 'twitter');
    const snapshot = await getDoc(docRef);

    if (snapshot.exists()) {
      const data = snapshot.data();
      return data['keywords'] || [];
    }

    // Initialize with defaults
    console.log('[SourceConfig] No Twitter config found, initializing with defaults');
    const defaults = this.createDefaultKeywords();
    await this.saveTwitterKeywords(defaults);
    return defaults;
  }

  /**
   * Load GitHub repos from Firestore
   */
  private async loadGitHubConfig(): Promise<GitHubRepoConfig[]> {
    const docRef = doc(this.firestore, this.CONFIG_COLLECTION, 'github');
    const snapshot = await getDoc(docRef);

    if (snapshot.exists()) {
      const data = snapshot.data();
      return data['repos'] || [];
    }

    // Initialize with defaults
    console.log('[SourceConfig] No GitHub config found, initializing with defaults');
    const defaults = this.createDefaultGitHubRepos();
    await this.saveGitHubRepos(defaults);
    return defaults;
  }

  /**
   * Load Discourse forums from Firestore
   */
  private async loadDiscourseConfig(): Promise<DiscourseConfig[]> {
    const docRef = doc(this.firestore, this.CONFIG_COLLECTION, 'discourse');
    const snapshot = await getDoc(docRef);

    if (snapshot.exists()) {
      const data = snapshot.data();
      return data['forums'] || [];
    }

    // Initialize with defaults
    console.log('[SourceConfig] No Discourse config found, initializing with defaults');
    const defaults = this.createDefaultDiscourseForums();
    await this.saveDiscourseForums(defaults);
    return defaults;
  }

  /**
   * Save Twitter keywords to Firestore
   */
  async saveTwitterKeywords(keywords: SearchKeyword[]): Promise<void> {
    const docRef = doc(this.firestore, this.CONFIG_COLLECTION, 'twitter');
    await setDoc(docRef, {
      enabled: true,
      keywords: keywords,
      updatedAt: new Date()
    }, { merge: true });
    this.twitterKeywords.set(keywords);
    console.log(`[SourceConfig] Saved ${keywords.length} Twitter keywords`);
  }

  /**
   * Save GitHub repos to Firestore
   */
  async saveGitHubRepos(repos: GitHubRepoConfig[]): Promise<void> {
    const docRef = doc(this.firestore, this.CONFIG_COLLECTION, 'github');
    await setDoc(docRef, {
      enabled: true,
      repos: repos,
      updatedAt: new Date()
    }, { merge: true });
    this.githubRepos.set(repos);
    console.log(`[SourceConfig] Saved ${repos.length} GitHub repos`);
  }

  /**
   * Save Discourse forums to Firestore
   */
  async saveDiscourseForums(forums: DiscourseConfig[]): Promise<void> {
    const docRef = doc(this.firestore, this.CONFIG_COLLECTION, 'discourse');
    await setDoc(docRef, {
      enabled: true,
      forums: forums,
      updatedAt: new Date()
    }, { merge: true });
    this.discourseForums.set(forums);
    console.log(`[SourceConfig] Saved ${forums.length} Discourse forums`);
  }

  /**
   * Create default Twitter keywords with IDs
   */
  private createDefaultKeywords(): SearchKeyword[] {
    return DEFAULT_KEYWORDS.map((kw, index) => ({
      ...kw,
      id: `keyword-${index + 1}`,
      createdAt: new Date()
    }));
  }

  /**
   * Create default GitHub repos with IDs
   */
  private createDefaultGitHubRepos(): GitHubRepoConfig[] {
    return DEFAULT_GITHUB_REPOS.map((repo) => ({
      ...repo,
      id: `${repo.owner}-${repo.repo}`,
      createdAt: new Date()
    }));
  }

  /**
   * Create default Discourse forums with IDs
   */
  private createDefaultDiscourseForums(): DiscourseConfig[] {
    return DEFAULT_DISCOURSE.map((forum, index) => ({
      ...forum,
      id: `discourse-${index + 1}`,
      createdAt: new Date()
    }));
  }
}
