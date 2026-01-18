/**
 * GeminiService - Main service for AI content generation
 * Refactored to use modular prompts and parsers
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FeedItem, GeneratedThread, ThreadTweet } from '../models/feed.model';
import { UserSettingsService } from './user-settings.service';
import { I18nService } from '../i18n';
import { Platform, PlatformContent } from '../models/platform-content.model';
import { LoggerService } from './logger.service';

// Modular imports
import { buildPlatformPrompt, buildTwitterPrompt, buildRegenerateTweetPrompt } from './gemini/platform-prompts';
import { parseThreadResponse, parsePlatformResponse } from './gemini/response-parsers';

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private http = inject(HttpClient);
  private userSettings = inject(UserSettingsService);
  private i18n = inject(I18nService);
  private logger = inject(LoggerService);

  private readonly API_BASE = '/api/gemini';

  private getApiKey(): string {
    const apiKey = this.userSettings.getGeminiApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key não configurada. Configure em ⚙️ Configurações.');
    }
    return apiKey;
  }

  /**
   * Make a request to Gemini API
   */
  private async callGeminiApi(prompt: string, additionalUrls: string[] = [], options: { temperature?: number; maxTokens?: number } = {}): Promise<string> {
    const requestBody: any = {
      apiKey: this.getApiKey(),
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: options.temperature ?? 0.8,
        topP: 0.95,
        maxOutputTokens: options.maxTokens ?? 4096
      }
    };

    if (additionalUrls.length > 0) {
      requestBody.tools = [{ url_context: {} }];
    }

    const response = await this.http.post<GeminiResponse>(
      `${this.API_BASE}/generate`,
      requestBody
    ).toPromise();

    if (response?.error) {
      throw new Error(response.error.message || 'API error');
    }

    return response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * Generate a Twitter thread from selected feed items
   */
  async generateThread(items: FeedItem[], additionalUrls: string[] = []): Promise<GeneratedThread> {
    const lang = this.i18n.getLanguageForPrompt();
    const prompt = buildTwitterPrompt(items, additionalUrls, lang);

    try {
      const text = await this.callGeminiApi(prompt, additionalUrls);
      return parseThreadResponse(text, items);
    } catch (error) {
      this.logger.error('GeminiService', 'Error generating thread:', error);
      throw new Error('Falha ao gerar thread. Verifique sua API key do Gemini.');
    }
  }

  /**
   * Regenerate a specific tweet in the thread
   */
  async regenerateTweet(thread: GeneratedThread, tweetIndex: number, feedback?: string): Promise<ThreadTweet> {
    const tweet = thread.tweets.find(t => t.index === tweetIndex);
    if (!tweet) {
      throw new Error('Tweet not found');
    }

    const lang = this.i18n.getLanguageForPrompt();
    const prompt = buildRegenerateTweetPrompt(tweet.content, lang, feedback);

    try {
      const newContent = await this.callGeminiApi(prompt, [], { temperature: 0.9, maxTokens: 300 });

      // Clean up any markdown formatting the model might add
      const cleanContent = newContent
        .replace(/^["']|["']$/g, '')
        .trim();

      return {
        ...tweet,
        content: cleanContent
      };
    } catch (error) {
      this.logger.error('GeminiService', 'Error regenerating tweet:', error);
      throw error;
    }
  }

  /**
   * Generate content for a specific platform
   */
  async generateContentForPlatform(
    platform: Platform,
    items: FeedItem[],
    additionalUrls: string[] = []
  ): Promise<PlatformContent> {
    const lang = this.i18n.getLanguageForPrompt();
    const prompt = buildPlatformPrompt(platform, items, additionalUrls, lang);

    try {
      const text = await this.callGeminiApi(prompt, additionalUrls);
      return parsePlatformResponse(platform, text, items);
    } catch (error) {
      this.logger.error('GeminiService', `Error generating ${platform} content:`, error);
      throw new Error(`Failed to generate ${platform} content.`);
    }
  }
}
