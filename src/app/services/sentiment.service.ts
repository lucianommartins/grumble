import { Injectable, inject } from '@angular/core';
import { FeedbackItem, Sentiment, FeedbackCategory, FeedbackGroup, FeedbackSourceType } from '../models/feedback.model';
import { UserSettingsService } from './user-settings.service';
import { LoggerService } from './logger.service';

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
   * Translate feedback items to ALL 8 supported languages at sync time
   * Returns a map of itemId -> translations map (e.g., { en: '...', pt: '...', etc. })
   */
  async translateToAllLanguages(
    items: FeedbackItem[]
  ): Promise<Map<string, { translations: Record<string, string>; translatedTitles?: Record<string, string> }>> {
    const results = new Map<string, { translations: Record<string, string>; translatedTitles?: Record<string, string> }>();

    // Only translate items that don't already have translations
    const needsTranslation = items.filter(item => 
      item.language && !item.translations
    );

    this.logger.debug('Sentiment', `Items needing translation to all languages: ${needsTranslation.length}`);

    if (needsTranslation.length === 0) {
      return results;
    }

    const apiKey = this.userSettings.getGeminiApiKey();
    if (!apiKey) {
      return results;
    }

    const targetLanguages = ['en', 'pt', 'es', 'fr', 'de', 'ja', 'zh'];

    // Process in smaller batches (fewer items per batch since we're translating to 7 languages)
    const batchSize = 5;
    for (let i = 0; i < needsTranslation.length; i += batchSize) {
      const batch = needsTranslation.slice(i, i + batchSize);
      const prompt = this.buildMultiLanguageTranslationPrompt(batch, targetLanguages);

      try {
        const response = await this.callGemini(apiKey, prompt);
        const data = JSON.parse(response);

        for (const itemTranslation of data.items || []) {
          results.set(itemTranslation.itemId, {
            translations: itemTranslation.translations || {},
            translatedTitles: itemTranslation.titles || undefined,
          });
        }

        this.logger.debug('Sentiment', `Translated batch ${Math.floor(i / batchSize) + 1}, ${results.size} items total`);
      } catch (error) {
        this.logger.error('Sentiment', 'Multi-language translation batch failed:', error);
      }
    }

    this.logger.info('Sentiment', `Translated ${results.size} items to all ${targetLanguages.length} languages`);
    return results;
  }

  private buildMultiLanguageTranslationPrompt(items: FeedbackItem[], targetLangs: string[]): string {
    const langNames: Record<string, string> = {
      'en': 'English', 'pt': 'Portuguese', 'es': 'Spanish',
      'fr': 'French', 'de': 'German', 'ja': 'Japanese', 'zh': 'Chinese',
    };

    const itemsText = items.map(item => `
[ITEM] ID: ${item.id}
SOURCE_LANG: ${item.language}
${item.title ? `TITLE: ${item.title}` : ''}
CONTENT: ${item.content.substring(0, 400)}
---`).join('\n');

    const targetsList = targetLangs.map(l => `${l} (${langNames[l]})`).join(', ');

    return `Translate these feedback items to ALL of these languages: ${targetsList}.
Skip translating to the same language as SOURCE_LANG.

${itemsText}

Respond in JSON:
{
  "items": [
    {
      "itemId": "the item ID",
      "translations": {
        "en": "English translation",
        "pt": "Portuguese translation",
        "es": "Spanish translation",
        "fr": "French translation",
        "de": "German translation",
        "ja": "Japanese translation",
        "zh": "Chinese translation"
      },
      "titles": { ... same structure if title exists ... }
    }
  ]
}

Keep translations natural. Preserve technical terms. Skip the source language.`;
  }

  /**
   * Normalize language codes for comparison
   * Maps variations to base codes (pt-br -> pt, zh-cn -> zh, etc.)
   */
  private normalizeLanguageCode(lang: string): string {
    const code = lang.toLowerCase();
    if (code.startsWith('pt')) return 'pt';
    if (code.startsWith('zh')) return 'zh';
    if (code.startsWith('en')) return 'en';
    if (code.startsWith('es')) return 'es';
    if (code.startsWith('fr')) return 'fr';
    if (code.startsWith('de')) return 'de';
    if (code.startsWith('ja')) return 'ja';
    return code;
  }

  private buildTranslationPrompt(items: FeedbackItem[], targetLang: string): string {
    const langNames: Record<string, string> = {
      'en': 'English',
      'pt-br': 'Brazilian Portuguese',
      'pt-pt': 'Portuguese',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'ja': 'Japanese',
      'zh': 'Chinese',
    };

    const targetName = langNames[targetLang] || targetLang;

    const itemsText = items.map(item => `
[ITEM] ID: ${item.id}
LANG: ${item.language}
${item.title ? `TITLE: ${item.title}` : ''}
CONTENT: ${item.content.substring(0, 500)}
---`).join('\n');

    return `Translate these feedback items to ${targetName}.

${itemsText}

Respond in JSON:
{
  "translations": [
    {
      "itemId": "the item ID",
      "title": "translated title if exists",
      "content": "translated content"
    }
  ]
}

Keep translations natural and conversational. Preserve technical terms.`;
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

  /**
   * Consolidate similar groups from different batches
   * Merges groups with similar themes into single groups
   */
  async consolidateSimilarGroups(groups: FeedbackGroup[]): Promise<FeedbackGroup[]> {
    if (groups.length < 2) {
      return groups;
    }

    const apiKey = this.userSettings.getGeminiApiKey();
    if (!apiKey) {
      return groups;
    }

    const prompt = this.buildConsolidationPrompt(groups);

    try {
      const response = await this.callGemini(apiKey, prompt);
      return this.parseConsolidationResponse(response, groups);
    } catch (error) {
      this.logger.error('Sentiment', 'Failed to consolidate groups:', error);
      return groups;
    }
  }

  private buildConsolidationPrompt(groups: FeedbackGroup[]): string {
    const groupsText = groups.map((group, i) => `
[${i + 1}] ID: ${group.id}
THEME: ${group.theme}
SUMMARY: ${group.summary}
SENTIMENT: ${group.sentiment}
CATEGORY: ${group.category}
ITEM_COUNT: ${group.itemCount}
ITEM_IDS: ${group.itemIds.join(', ')}
---`).join('\n');

    return `These ${groups.length} feedback groups may contain duplicates (same topic with different names).
Consolidate groups that are about the SAME issue into single merged groups.

${groupsText}

Respond in JSON:
{
  "mergedGroups": [
    {
      "theme": "Unified theme name for merged groups",
      "summary": "Combined summary of all merged groups",
      "sentiment": "positive" | "neutral" | "negative",
      "category": "bug-report" | "feature-request" | "performance-issue" | "documentation-gap" | "integration-problem" | "breaking-change" | "pricing-quota" | "praise" | "question" | "other",
      "originalGroupIds": ["id1", "id2"],
      "allItemIds": ["item1", "item2", "item3"]
    }
  ]
}

Rules:
- Only merge groups that are CLEARLY about the same topic
- Groups that are unique should still appear (originalGroupIds will have 1 entry)
- Combine all itemIds from merged groups into allItemIds
- Pick the most descriptive theme name`;
  }

  private parseConsolidationResponse(response: string, originalGroups: FeedbackGroup[]): FeedbackGroup[] {
    try {
      const data = JSON.parse(response);
      const mergedGroups: FeedbackGroup[] = [];

      for (const merged of data.mergedGroups || []) {
        // Find source types and languages from original groups
        const sourceGroupIds = new Set(merged.originalGroupIds || []);
        const sourceGroups = originalGroups.filter(g => sourceGroupIds.has(g.id));

        const allSources: FeedbackGroup['sources'] = [];
        const allLanguages: string[] = [];

        for (const sg of sourceGroups) {
          allSources.push(...(sg.sources || []));
          allLanguages.push(...(sg.languages || []));
        }

        mergedGroups.push({
          id: `merged-${Date.now()}-${mergedGroups.length}`,
          theme: merged.theme,
          summary: merged.summary,
          sentiment: merged.sentiment,
          category: merged.category,
          itemIds: merged.allItemIds || [],
          itemCount: (merged.allItemIds || []).length,
          sources: allSources,
          languages: [...new Set(allLanguages)],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      this.logger.info('Sentiment', `Consolidated ${originalGroups.length} groups into ${mergedGroups.length}`);
      return mergedGroups;
    } catch (error) {
      this.logger.error('Sentiment', 'Failed to parse consolidation response:', error);
      return originalGroups;
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

    const response = await fetch(url, {
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

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

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
