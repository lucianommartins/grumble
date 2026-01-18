/**
 * Platform-specific prompt builders for content generation
 * Extracted from GeminiService to improve maintainability
 */

import { FeedItem } from '../../models/feed.model';
import { Platform } from '../../models/platform-content.model';
import { I18nService } from '../../i18n';

/**
 * Builds content summary from feed items for use in prompts
 */
export function buildContentSummary(items: FeedItem[]): string {
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

/**
 * Builds additional URLs section for prompts
 */
export function buildUrlsSection(additionalUrls: string[]): string {
  if (additionalUrls.length === 0) return '';
  return `\n## Additional URLs for Context\nPlease access and use the content from these URLs to enrich the post:\n${additionalUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}\n`;
}

/**
 * Builds Twitter thread prompt
 */
export function buildTwitterPrompt(items: FeedItem[], additionalUrls: string[], lang: string): string {
  const contentSummary = buildContentSummary(items);
  const urlsSection = buildUrlsSection(additionalUrls);

  return `You are an expert at creating engaging Twitter/X threads in ${lang}.

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
${urlsSection}
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

/**
 * Builds LinkedIn post prompt
 */
export function buildLinkedInPrompt(items: FeedItem[], additionalUrls: string[], lang: string): string {
  const contentSummary = buildContentSummary(items);
  const urlsSection = buildUrlsSection(additionalUrls);

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
    "content": "Your main LinkedIn post text here...\\n\\n#hashtag1 #hashtag2",
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

/**
 * Builds Threads prompt
 */
export function buildThreadsPrompt(items: FeedItem[], additionalUrls: string[], lang: string): string {
  const contentSummary = buildContentSummary(items);
  const urlsSection = buildUrlsSection(additionalUrls);

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

/**
 * Builds BlueSky prompt
 */
export function buildBlueskyPrompt(items: FeedItem[], additionalUrls: string[], lang: string): string {
  const contentSummary = buildContentSummary(items);
  const urlsSection = buildUrlsSection(additionalUrls);

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

/**
 * Builds regeneration prompt for a single tweet
 */
export function buildRegenerateTweetPrompt(currentContent: string, lang: string, feedback?: string): string {
  return `Rewrite this tweet into ${lang}. The original tweet may be in any language.

Original tweet: "${currentContent}"
${feedback ? `User feedback: ${feedback}` : ''}

Rules:
- Maximum 280 characters
- Output MUST be in ${lang}
- Keep the context and meaning of the original tweet
- Use Twitter engagement techniques for ${lang} audience

Reply ONLY with the text of the new tweet, no explanations.`;
}

/**
 * Get appropriate prompt builder for a platform
 */
export function buildPlatformPrompt(
  platform: Platform,
  items: FeedItem[],
  additionalUrls: string[],
  lang: string
): string {
  switch (platform) {
    case 'linkedin':
      return buildLinkedInPrompt(items, additionalUrls, lang);
    case 'threads':
      return buildThreadsPrompt(items, additionalUrls, lang);
    case 'bluesky':
      return buildBlueskyPrompt(items, additionalUrls, lang);
    case 'twitter':
    default:
      return buildTwitterPrompt(items, additionalUrls, lang);
  }
}
