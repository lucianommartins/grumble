import { Injectable, inject } from '@angular/core';
import { FeedbackItem, Sentiment, FeedbackCategory, FeedbackGroup, FeedbackSourceType } from '../models/feedback.model';
import { UserSettingsService } from './user-settings.service';
import { LoggerService } from './logger.service';
import { RetryService } from './retry.service';

interface AnalysisResult {
  sentiment: Sentiment;
  sentimentConfidence: number;
  category: FeedbackCategory;
  categoryConfidence: number;
  summary: string;
}

interface BatchAnalysisResult {
  itemId: string;
  analysis: AnalysisResult;
}

interface GroupingResult {
  groups: {
    theme: string;
    summary: string;
    sentiment: Sentiment;
    category: FeedbackCategory;
    itemIds: string[];
  }[];
}

/**
 * SentimentService handles AI-powered analysis of feedback items
 * using Gemini 3.0 Flash for sentiment, categorization, and grouping
 */
@Injectable({
  providedIn: 'root'
})
export class SentimentService {
  private userSettings = inject(UserSettingsService);
  private logger = inject(LoggerService);
  private retry = inject(RetryService);

  private readonly MODEL = 'gemini-3-flash-preview';

  /**
   * Analyze a single feedback item
   */
  async analyzeItem(item: FeedbackItem): Promise<AnalysisResult> {
    const apiKey = this.userSettings.getGeminiApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const prompt = this.buildAnalysisPrompt(item);

    try {
      const response = await this.callGemini(apiKey, prompt);
      return this.parseAnalysisResponse(response);
    } catch (error) {
      this.logger.error('Sentiment', 'Failed to analyze item:', error);
      // Return neutral defaults on error
      return {
        sentiment: 'neutral',
        sentimentConfidence: 0,
        category: 'other',
        categoryConfidence: 0,
        summary: item.content.substring(0, 100),
      };
    }
  }

  /**
   * Batch analyze multiple items for efficiency
   */
  async analyzeBatch(items: FeedbackItem[]): Promise<Map<string, AnalysisResult>> {
    const apiKey = this.userSettings.getGeminiApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const results = new Map<string, AnalysisResult>();

    // Process in batches of 10 for optimal API usage
    const batchSize = 10;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const prompt = this.buildBatchAnalysisPrompt(batch);

      try {
        const response = await this.callGemini(apiKey, prompt);
        const batchResults = this.parseBatchResponse(response, batch);

        for (const result of batchResults) {
          results.set(result.itemId, result.analysis);
        }
      } catch (error) {
        this.logger.error('Sentiment', `Failed to analyze batch ${i / batchSize + 1}:`, error);
        // Add neutral defaults for failed batch
        for (const item of batch) {
          results.set(item.id, {
            sentiment: 'neutral',
            sentimentConfidence: 0,
            category: 'other',
            categoryConfidence: 0,
            summary: item.content.substring(0, 100),
          });
        }
      }
    }

    this.logger.info('Sentiment', `Analyzed ${results.size} items`);
    return results;
  }

  /**
   * Analyze a single batch directly (for progressive UI updates)
   */
  async analyzeBatchDirect(items: FeedbackItem[]): Promise<Map<string, AnalysisResult>> {
    const apiKey = this.userSettings.getGeminiApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const results = new Map<string, AnalysisResult>();
    const prompt = this.buildBatchAnalysisPrompt(items);

    try {
      const response = await this.callGemini(apiKey, prompt);
      const batchResults = this.parseBatchResponse(response, items);

      for (const result of batchResults) {
        results.set(result.itemId, result.analysis);
      }
    } catch (error) {
      this.logger.error('Sentiment', 'Batch analysis failed:', error);
      // Add neutral defaults for failed batch
      for (const item of items) {
        results.set(item.id, {
          sentiment: 'neutral',
          sentimentConfidence: 0,
          category: 'other',
          categoryConfidence: 0,
          summary: item.content.substring(0, 100),
        });
      }
    }

    return results;
  }

  /**
   * Group similar feedback items
   */
  async groupSimilarItems(items: FeedbackItem[]): Promise<FeedbackGroup[]> {
    const apiKey = this.userSettings.getGeminiApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    if (items.length < 2) {
      return [];
    }

    const prompt = this.buildGroupingPrompt(items);

    try {
      const response = await this.callGemini(apiKey, prompt);
      return this.parseGroupingResponse(response, items);
    } catch (error) {
      this.logger.error('Sentiment', 'Failed to group items:', error);
      return [];
    }
  }

  private buildAnalysisPrompt(item: FeedbackItem): string {
    return `Analyze this user feedback about Gemini API/AI Studio.

SOURCE: ${item.sourceType} (${item.sourceName})
${item.title ? `TITLE: ${item.title}` : ''}
CONTENT: ${item.content.substring(0, 1500)}

Respond in JSON format:
{
  "sentiment": "positive" | "neutral" | "negative",
  "sentimentConfidence": 0.0-1.0,
  "category": "bug-report" | "feature-request" | "performance-issue" | "documentation-gap" | "integration-problem" | "breaking-change" | "pricing-quota" | "praise" | "question" | "other",
  "categoryConfidence": 0.0-1.0,
  "summary": "One sentence summary of the feedback"
}

Guidelines:
- "positive": Praise, thanks, excitement about features
- "neutral": Questions, general discussion, factual statements
- "negative": Complaints, frustration, bug reports with negative tone
- Categorize based on the PRIMARY intent of the feedback`;
  }

  private buildBatchAnalysisPrompt(items: FeedbackItem[]): string {
    const itemsText = items.map((item, i) => `
[ITEM ${i + 1}] ID: ${item.id}
SOURCE: ${item.sourceType}
${item.title ? `TITLE: ${item.title}` : ''}
CONTENT: ${item.content.substring(0, 500)}
---`).join('\n');

    return `Analyze these ${items.length} user feedbacks about Gemini API/AI Studio.

${itemsText}

Respond in JSON format:
{
  "analyses": [
    {
      "itemId": "the item ID",
      "sentiment": "positive" | "neutral" | "negative",
      "sentimentConfidence": 0.0-1.0,
      "category": "bug-report" | "feature-request" | "performance-issue" | "documentation-gap" | "integration-problem" | "breaking-change" | "pricing-quota" | "praise" | "question" | "other",
      "categoryConfidence": 0.0-1.0,
      "summary": "One sentence summary"
    }
  ]
}

Guidelines:
- "positive": Praise, thanks, excitement
- "neutral": Questions, discussions
- "negative": Complaints, frustration, bugs
- Categorize by PRIMARY intent`;
  }

  private buildGroupingPrompt(items: FeedbackItem[]): string {
    const itemsText = items.map((item, i) => `
[${i + 1}] ID: ${item.id}
${item.title ? `TITLE: ${item.title}` : ''}
CONTENT: ${item.content.substring(0, 300)}
SENTIMENT: ${item.sentiment || 'unknown'}
---`).join('\n');

    return `Group these ${items.length} feedback items by similar themes/complaints.

${itemsText}

Identify groups of 2+ items discussing the SAME issue/topic.

Respond in JSON:
{
  "groups": [
    {
      "theme": "Brief theme name (e.g., 'Rate limit errors in Python SDK')",
      "summary": "Detailed summary of the shared concern",
      "sentiment": "positive" | "neutral" | "negative",
      "category": "bug-report" | "feature-request" | "performance-issue" | "documentation-gap" | "integration-problem" | "breaking-change" | "pricing-quota" | "praise" | "question" | "other",
      "itemIds": ["id1", "id2", ...]
    }
  ]
}

Only create groups for items that are GENUINELY about the same topic.
Items can only belong to ONE group.
Skip items that don't fit any group.`;
  }

  private async callGemini(apiKey: string, prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL}:generateContent?key=${apiKey}`;

    const response = await this.retry.withRetry(async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          }
        })
      });

      if (!res.ok) {
        throw new Error(`Gemini API error: ${res.status}`);
      }
      return res;
    }, {}, 'Gemini Analysis');

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  }

  private parseAnalysisResponse(response: string): AnalysisResult {
    try {
      const json = JSON.parse(response);
      return {
        sentiment: json.sentiment || 'neutral',
        sentimentConfidence: json.sentimentConfidence || 0,
        category: json.category || 'other',
        categoryConfidence: json.categoryConfidence || 0,
        summary: json.summary || '',
      };
    } catch {
      return {
        sentiment: 'neutral',
        sentimentConfidence: 0,
        category: 'other',
        categoryConfidence: 0,
        summary: '',
      };
    }
  }

  private parseBatchResponse(response: string, items: FeedbackItem[]): BatchAnalysisResult[] {
    try {
      const json = JSON.parse(response);
      const analyses = json.analyses || [];

      return analyses.map((a: any) => ({
        itemId: a.itemId,
        analysis: {
          sentiment: a.sentiment || 'neutral',
          sentimentConfidence: a.sentimentConfidence || 0,
          category: a.category || 'other',
          categoryConfidence: a.categoryConfidence || 0,
          summary: a.summary || '',
        }
      }));
    } catch {
      return items.map(item => ({
        itemId: item.id,
        analysis: {
          sentiment: 'neutral' as Sentiment,
          sentimentConfidence: 0,
          category: 'other' as FeedbackCategory,
          categoryConfidence: 0,
          summary: '',
        }
      }));
    }
  }

  private parseGroupingResponse(response: string, items: FeedbackItem[]): FeedbackGroup[] {
    try {
      const json: GroupingResult = JSON.parse(response);

      return (json.groups || []).map((g, index) => ({
        id: `group-${Date.now()}-${index}`,
        theme: g.theme,
        summary: g.summary,
        sentiment: g.sentiment || 'neutral',
        category: g.category || 'other',
        itemIds: g.itemIds || [],
        itemCount: (g.itemIds || []).length,
        sources: this.countSourcesInGroup(g.itemIds, items) as { type: FeedbackSourceType; count: number }[],
        languages: this.getLanguagesInGroup(g.itemIds, items),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    } catch {
      return [];
    }
  }

  private countSourcesInGroup(
    itemIds: string[],
    items: FeedbackItem[]
  ): { type: string; count: number }[] {
    const counts = new Map<string, number>();
    const itemMap = new Map(items.map(i => [i.id, i]));

    for (const id of itemIds) {
      const item = itemMap.get(id);
      if (item) {
        counts.set(item.sourceType, (counts.get(item.sourceType) || 0) + 1);
      }
    }

    return Array.from(counts.entries()).map(([type, count]) => ({ type, count }));
  }

  private getLanguagesInGroup(itemIds: string[], items: FeedbackItem[]): string[] {
    const languages = new Set<string>();
    const itemMap = new Map(items.map(i => [i.id, i]));

    for (const id of itemIds) {
      const item = itemMap.get(id);
      if (item?.language) {
        languages.add(item.language);
      }
    }

    return Array.from(languages);
  }
}
