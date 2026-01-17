import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FeedItem, GeneratedThread, ThreadTweet } from '../models/feed.model';
import { UserSettingsService } from './user-settings.service';
import { I18nService } from '../i18n';
import { Platform, PlatformContent, PlatformPost, PLATFORMS } from '../models/platform-content.model';

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

// LinkedIn specific response structure
interface LinkedInResponse {
  mainPost: {
    content: string;
    media?: {
      type: 'image' | 'video';
      prompt: string;
    };
  };
  comment: {
    content: string;
    referenceLink: string;
  };
}

// Thread-based platform response structure
interface ThreadResponse {
  posts: Array<{
    index: number;
    content: string;
    media?: {
      type: 'image' | 'video';
      prompt: string;
      tool: 'nanobanana' | 'veo3';
    };
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private http = inject(HttpClient);
  private userSettings = inject(UserSettingsService);
  private i18n = inject(I18nService);

  // Use proxy server
  private readonly API_BASE = '/api/gemini';

  private getApiKey(): string {
    const apiKey = this.userSettings.getGeminiApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key não configurada. Configure em ⚙️ Configurações.');
    }
    return apiKey;
  }

  /**
   * Generate a Twitter thread from selected feed items
   */
  async generateThread(items: FeedItem[], additionalUrls: string[] = []): Promise<GeneratedThread> {
    const prompt = this.buildPrompt(items, additionalUrls);

    // Build request body with API key from user settings
    const requestBody: any = {
      apiKey: this.getApiKey(),
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.8,
        topP: 0.95,
        maxOutputTokens: 4096
      }
    };

    // Add URL context tool if there are additional URLs
    if (additionalUrls.length > 0) {
      requestBody.tools = [{ url_context: {} }];
    }

    try {
      const response = await this.http.post<GeminiResponse>(
        `${this.API_BASE}/generate`,
        requestBody
      ).toPromise();

      if (response?.error) {
        throw new Error(response.error.message || 'API error');
      }

      const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return this.parseThreadResponse(text, items);

    } catch (error) {
      console.error('Error generating thread:', error);
      throw new Error('Falha ao gerar thread. Verifique sua API key do Gemini.');
    }
  }

  private buildPrompt(items: FeedItem[], additionalUrls: string[] = []): string {
    const lang = this.i18n.getLanguageForPrompt();

    const contentSummary = items.map((item, i) => {
      const title = item.title ? `Title: ${item.title}\n` : '';
      return `
### Content ${i + 1}
Source: ${item.feedName} (${item.authorHandle || item.author})
${title}Content: ${item.content}
URL: ${item.url}
Date: ${new Date(item.publishedAt).toLocaleDateString('en-US')}
`;
    }).join('\n');

    // Add additional URLs section if provided
    const additionalUrlsSection = additionalUrls.length > 0
      ? `\n## Additional URLs for Context\nPlease access and use the content from these URLs to enrich the thread:\n${additionalUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}\n`
      : '';

    return `You are an expert at creating viral Twitter/X threads in ${lang}.

## Task
Create a Twitter thread based on the content below. The thread must:

1. **Format**: Each tweet must have a MAXIMUM of 280 characters
2. **Language**: ${lang}, professional but accessible tone
3. **Engagement**: Use copywriting techniques to maximize engagement:
   - First tweet with a strong hook (curiosity or value promise)
   - Strategic emojis (don't overdo it)
   - Rhetorical questions
   - Bullets for easy reading
   - CTA at the end (like, share, follow)
4. **Structure**: 
   - Tweet 1: Impactful hook/opening
   - Tweets 2-N: Development of main points
   - Second-to-last tweet: Links to original sources (REQUIRED to include URLs from reference content)
   - Last tweet: Conclusion + CTA
5. **Media**: For each tweet where an image or video would be impactful, include a placeholder with a generation prompt.
6. **Links**: IMPORTANT - Include links to original sources in one of the tweets. Use format: "🔗 Sources: [links]"

## Reference Content
${contentSummary}
${additionalUrlsSection}
## Response Format
Respond EXACTLY in this JSON format:
{
  "tweets": [
    {
      "index": 1,
      "content": "Tweet 1 text...",
      "media": {
        "type": "image",
        "prompt": "Prompt for Google Imagen to generate the image...",
        "tool": "nanobanana"
      }
    },
    {
      "index": 2,
      "content": "Tweet 2 text...",
      "media": null
    }
  ]
}

For videos, use "type": "video" and "tool": "veo3".
If no media, use "media": null.
IMPORTANT: When generating media prompts, always use light theme. Include bright, colorful backgrounds for images and videos.

Generate the thread now:`;
  }

  private parseThreadResponse(text: string, sourceItems: FeedItem[]): GeneratedThread {
    try {
      // Extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const tweets: ThreadTweet[] = parsed.tweets.map((tweet: any) => ({
        index: tweet.index,
        content: tweet.content,
        mediaPlaceholder: tweet.media ? {
          type: tweet.media.type as 'image' | 'video',
          prompt: tweet.media.prompt,
          tool: tweet.media.tool as 'veo3' | 'nanobanana'
        } : undefined
      }));

      return {
        id: `thread_${Date.now()}`,
        tweets,
        generatedAt: new Date(),
        sourceItems: sourceItems.map(item => item.id)
      };

    } catch (error) {
      console.error('Error parsing thread response:', error);
      return {
        id: `thread_${Date.now()}`,
        tweets: [{
          index: 1,
          content: 'Erro ao processar a thread. Por favor, tente novamente.',
          mediaPlaceholder: undefined
        }],
        generatedAt: new Date(),
        sourceItems: sourceItems.map(item => item.id)
      };
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
    const prompt = `Rewrite this tweet into ${lang}. The original tweet may be in any language.

Original tweet: "${tweet.content}"
${feedback ? `User feedback: ${feedback}` : ''}

Rules:
- Maximum 280 characters
- Output MUST be in ${lang}
- Keep the context and meaning of the original tweet
- Use Twitter engagement techniques for ${lang} audience

Reply ONLY with the text of the new tweet, no explanations.`;

    try {
      const response = await this.http.post<GeminiResponse>(
        `${this.API_BASE}/generate`,
        {
          apiKey: this.getApiKey(),
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: {
            temperature: 0.9,
            maxOutputTokens: 300
          }
        }
      ).toPromise();

      const newContent = response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || tweet.content;

      // Clean up any markdown formatting the model might add
      const cleanContent = newContent
        .replace(/^["']|["']$/g, '')  // Remove surrounding quotes
        .trim();

      return {
        ...tweet,
        content: cleanContent
      };

    } catch (error) {
      console.error('Error regenerating tweet:', error);
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
    const prompt = this.buildPlatformPrompt(platform, items, additionalUrls);

    const requestBody: any = {
      apiKey: this.getApiKey(),
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.8,
        topP: 0.95,
        maxOutputTokens: 4096
      }
    };

    if (additionalUrls.length > 0) {
      requestBody.tools = [{ url_context: {} }];
    }

    try {
      const response = await this.http.post<GeminiResponse>(
        `${this.API_BASE}/generate`,
        requestBody
      ).toPromise();

      if (response?.error) {
        throw new Error(response.error.message || 'API error');
      }

      const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return this.parsePlatformResponse(platform, text, items);

    } catch (error) {
      console.error(`Error generating ${platform} content:`, error);
      throw new Error(`Failed to generate ${platform} content.`);
    }
  }

  private buildPlatformPrompt(platform: Platform, items: FeedItem[], additionalUrls: string[]): string {
    switch (platform) {
      case 'linkedin':
        return this.buildLinkedInPrompt(items, additionalUrls);
      case 'threads':
        return this.buildThreadsPrompt(items, additionalUrls);
      case 'bluesky':
        return this.buildBlueskyPrompt(items, additionalUrls);
      default:
        return this.buildPrompt(items, additionalUrls);
    }
  }

  private buildLinkedInPrompt(items: FeedItem[], additionalUrls: string[]): string {
    const lang = this.i18n.getLanguageForPrompt();
    const contentSummary = this.buildContentSummary(items);
    const urlsSection = this.buildUrlsSection(additionalUrls);

    return `You are an expert at creating professional LinkedIn posts in ${lang}.

## Task
Create a LinkedIn post based on the content below. LinkedIn format:

1. **Main Post**: 
   - Maximum 3000 characters
   - Professional and informative tone
   - Use line breaks for readability
   - Include relevant hashtags (3-5)
   - One image or video suggestion

2. **Comment with Reference**: 
   - Add a follow-up comment with the source link
   - Brief, professional call-to-action
   - Include the original source URL

## Reference Content
${contentSummary}
${urlsSection}

## Response Format
Respond EXACTLY in this JSON format:
{
  "mainPost": {
    "content": "Your main LinkedIn post text here...\n\n#hashtag1 #hashtag2",
    "media": {
      "type": "image",
      "prompt": "Professional image prompt for the post"
    }
  },
  "comment": {
    "content": "Check out the full article for more insights:",
    "referenceLink": "https://original-source-url.com"
  }
}

For videos, use "type": "video" and "tool": "veo3".
If no media, use "media": null.
IMPORTANT: When generating media prompts, always use light theme. Include bright, colorful backgrounds for images and videos.

Generate the LinkedIn post now:`;
  }

  private buildThreadsPrompt(items: FeedItem[], additionalUrls: string[]): string {
    const lang = this.i18n.getLanguageForPrompt();
    const contentSummary = this.buildContentSummary(items);
    const urlsSection = this.buildUrlsSection(additionalUrls);

    return `You are an expert at creating engaging Threads (by Meta) threads in ${lang}.

## Task
Create a Threads thread based on the content below. Threads format:

1. **Character Limit**: Maximum 500 characters per post
2. **Tone**: Casual, authentic, friendly - more personal than Twitter
3. **Structure**:
   - First post: Hook/attention grabber
   - Middle posts: Key points with personality
   - Last post: Conclusion with emoji and engagement CTA
4. **Style**: Use emojis naturally, conversational language
5. **Media**: Optional image suggestions

## Reference Content
${contentSummary}
${urlsSection}

## Response Format
Respond EXACTLY in this JSON format:
{
  "posts": [
    {
      "index": 1,
      "content": "Post text here (max 500 chars)...",
      "media": {
        "type": "image",
        "prompt": "Casual, engaging image prompt",
        "tool": "nanobanana"
      }
    },
    {
      "index": 2,
      "content": "Post 2 text...",
      "media": null
    }
  ]
}

For videos, use "type": "video" and "tool": "veo3".
If no media, use "media": null.
IMPORTANT: When generating media prompts, always use light theme. Include bright, colorful backgrounds for images and videos.

Generate the Threads thread now:`;
  }

  private buildBlueskyPrompt(items: FeedItem[], additionalUrls: string[]): string {
    const lang = this.i18n.getLanguageForPrompt();
    const contentSummary = this.buildContentSummary(items);
    const urlsSection = this.buildUrlsSection(additionalUrls);

    return `You are an expert at creating engaging BlueSky threads in ${lang}.

## Task
Create a BlueSky thread based on the content below. BlueSky format:

1. **Character Limit**: Maximum 300 characters per post (shorter than Twitter!)
2. **Tone**: Thoughtful, tech-savvy, community-focused
3. **Style**: 
   - Clean, no excessive emojis
   - Clear and direct
   - Include references/links where relevant
4. **Structure**:
   - Opening: Strong hook
   - Body: Concise key points
   - Closing: Insight or call-to-action

## Reference Content
${contentSummary}
${urlsSection}

## Response Format
Respond EXACTLY in this JSON format:
{
  "posts": [
    {
      "index": 1,
      "content": "Post text here (max 300 chars)...",
      "media": {
        "type": "image",
        "prompt": "Clean, modern image prompt",
        "tool": "nanobanana"
      }
    }
  ]
}

For videos, use "type": "video" and "tool": "veo3".
If no media, use "media": null.
IMPORTANT: When generating media prompts, always use light theme. Include bright, colorful backgrounds for images and videos.

Generate the BlueSky thread now:`;
  }

  private buildContentSummary(items: FeedItem[]): string {
    return items.map((item, i) => {
      const title = item.title ? `Title: ${item.title}\n` : '';
      return `
### Content ${i + 1}
Source: ${item.feedName} (${item.authorHandle || item.author})
${title}Content: ${item.content}
URL: ${item.url}
Date: ${new Date(item.publishedAt).toLocaleDateString('en-US')}
`;
    }).join('\n');
  }

  private buildUrlsSection(additionalUrls: string[]): string {
    if (additionalUrls.length === 0) return '';
    return `\n## Additional URLs for Context\nPlease access and use the content from these URLs to enrich the post:\n${additionalUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}\n`;
  }

  private parsePlatformResponse(platform: Platform, text: string, sourceItems: FeedItem[]): PlatformContent {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (platform === 'linkedin') {
        return this.parseLinkedInResponse(parsed, sourceItems);
      } else {
        return this.parsePlatformThreadResponse(text, platform, sourceItems);
      }

    } catch (error) {
      console.error(`Error parsing ${platform} response:`, error);
      return {
        platform,
        posts: [{
          text: 'Error processing content. Please try again.',
          mediaPlaceholder: undefined
        }],
        error: 'Failed to parse response'
      };
    }
  }

  private parseLinkedInResponse(parsed: LinkedInResponse, sourceItems: FeedItem[]): PlatformContent {
    const posts: PlatformPost[] = [];

    // Main post
    posts.push({
      text: parsed.mainPost.content,
      mediaPlaceholder: parsed.mainPost.media
        ? `[${parsed.mainPost.media.type.toUpperCase()}]: ${parsed.mainPost.media.prompt}`
        : undefined
    });

    // Comment with link
    posts.push({
      text: parsed.comment.content,
      isComment: true,
      linkReference: parsed.comment.referenceLink || sourceItems[0]?.url
    });

    return {
      platform: 'linkedin',
      posts
    };
  }

  private parsePlatformThreadResponse(text: string, platform: Platform, sourceItems: FeedItem[]): PlatformContent {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }

    const parsed: ThreadResponse = JSON.parse(jsonMatch[0]);

    const posts: PlatformPost[] = parsed.posts.map(post => ({
      text: post.content,
      mediaPlaceholder: post.media
        ? `[${post.media.type.toUpperCase()}]: ${post.media.prompt}`
        : undefined
    }));

    return {
      platform,
      posts
    };
  }
}
