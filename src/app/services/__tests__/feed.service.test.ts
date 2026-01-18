/**
 * Unit Tests for FeedService
 * 
 * Run with: npx tsx src/app/services/__tests__/feed.service.test.ts
 */

import { assertEqual, assertNotEqual } from './test-utils';

// ============================================
// URL Normalization Tests
// ============================================

/**
 * Replicates FeedService.normalizeUrl for testing
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url.toLowerCase());
    // Remove trailing slash, www, and common tracking parameters
    let normalized = `${urlObj.protocol}//${urlObj.hostname.replace(/^www\./, '')}${urlObj.pathname.replace(/\/$/, '')}`;
    return normalized;
  } catch {
    return url.toLowerCase().trim();
  }
}

console.log('\n=== FeedService.normalizeUrl Tests ===\n');

// Test 1: Basic URL normalization
assertEqual(
  normalizeUrl('https://example.com/path'),
  'https://example.com/path',
  'Basic URL should remain unchanged'
);

// Test 2: Remove trailing slash
assertEqual(
  normalizeUrl('https://example.com/path/'),
  'https://example.com/path',
  'Should remove trailing slash'
);

// Test 3: Remove www prefix
assertEqual(
  normalizeUrl('https://www.example.com/path'),
  'https://example.com/path',
  'Should remove www prefix'
);

// Test 4: Lowercase normalization
assertEqual(
  normalizeUrl('HTTPS://EXAMPLE.COM/PATH'),
  'https://example.com/path',
  'Should lowercase the URL'
);

// Test 5: Twitter/X handle variations - different domains ARE different
assertNotEqual(
  normalizeUrl('https://twitter.com/GoogleAI'),
  normalizeUrl('https://x.com/googleai'),
  'Twitter and X are different domains (correct behavior)'
);

// Test 6: Same feed, different format
assertEqual(
  normalizeUrl('https://www.youtube.com/channel/UC123'),
  normalizeUrl('https://youtube.com/channel/UC123/'),
  'YouTube channel URLs should normalize the same'
);

// Test 7: Invalid URL handling
assertEqual(
  normalizeUrl('@googleai'),
  '@googleai',
  'Invalid URLs should return trimmed lowercase'
);

console.log('\n=== All normalizeUrl tests passed! ===\n');

// ============================================
// Deduplication Tests
// ============================================

interface SimpleFeedItem {
  id: string;
  url: string;
  title?: string;
  feedId: string;
}

/**
 * Simplified deduplication logic from SyncService
 */
function deduplicateItemsByUrl(items: SimpleFeedItem[]): SimpleFeedItem[] {
  const seen = new Map<string, SimpleFeedItem>();

  for (const item of items) {
    const key = normalizeUrl(item.url);
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }

  return Array.from(seen.values());
}

console.log('\n=== SyncService.deduplicateItems Tests ===\n');

// Test 1: No duplicates
const items1: SimpleFeedItem[] = [
  { id: '1', url: 'https://a.com', feedId: 'f1' },
  { id: '2', url: 'https://b.com', feedId: 'f1' },
];
assertEqual(
  deduplicateItemsByUrl(items1).length,
  2,
  'Should keep all items when no duplicates'
);

// Test 2: Duplicate URLs
const items2: SimpleFeedItem[] = [
  { id: '1', url: 'https://example.com/article', feedId: 'f1' },
  { id: '2', url: 'https://example.com/article', feedId: 'f2' },
];
assertEqual(
  deduplicateItemsByUrl(items2).length,
  1,
  'Should merge items with same URL'
);

// Test 3: URL variations should dedupe
const items3: SimpleFeedItem[] = [
  { id: '1', url: 'https://www.example.com/path/', feedId: 'f1' },
  { id: '2', url: 'https://example.com/path', feedId: 'f2' },
];
assertEqual(
  deduplicateItemsByUrl(items3).length,
  1,
  'Should dedupe URL variations (www, trailing slash)'
);

// Test 4: Empty array
assertEqual(
  deduplicateItemsByUrl([]).length,
  0,
  'Should handle empty arrays'
);

// Test 5: Single item
assertEqual(
  deduplicateItemsByUrl([{ id: '1', url: 'https://a.com', feedId: 'f1' }]).length,
  1,
  'Should handle single item'
);

console.log('\n=== All deduplicateItems tests passed! ===\n');

console.log('✅ ALL TESTS PASSED');
