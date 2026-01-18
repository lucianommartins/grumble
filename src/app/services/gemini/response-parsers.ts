/**
 * Response parsers for Gemini API responses
 * Extracted from GeminiService to improve maintainability
 */

import { FeedItem, GeneratedThread, ThreadTweet } from '../../models/feed.model';
import { Platform, PlatformContent, PlatformPost } from '../../models/platform-content.model';

/**
 * LinkedIn API response structure
 */
export interface LinkedInResponse {
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

/**
 * Thread-based platform response structure
 */
export interface ThreadResponse {
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

/**
 * Parses Twitter thread response from Gemini
 */
export function parseThreadResponse(text: string, sourceItems: FeedItem[]): GeneratedThread {
  try {
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
 * Parses LinkedIn response
 */
export function parseLinkedInResponse(parsed: LinkedInResponse, sourceItems: FeedItem[]): PlatformContent {
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

/**
 * Parses thread-based platform response (Threads, BlueSky)
 */
export function parsePlatformThreadResponse(text: string, platform: Platform, sourceItems: FeedItem[]): PlatformContent {
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

/**
 * Parses response based on platform type
 */
export function parsePlatformResponse(platform: Platform, text: string, sourceItems: FeedItem[]): PlatformContent {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (platform === 'linkedin') {
      return parseLinkedInResponse(parsed, sourceItems);
    } else {
      return parsePlatformThreadResponse(text, platform, sourceItems);
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
