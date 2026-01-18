import { Feed } from '../models/feed.model';

/**
 * Default feeds that come pre-configured with DevPulse.
 * Users can disable or remove these, but they serve as a starting point.
 */
export const DEFAULT_FEEDS: Omit<Feed, 'id' | 'createdAt' | 'lastSync'>[] = [
  // Twitter/X Sources
  {
    name: 'Google AI Devs',
    url: 'googleaidevs',
    type: 'twitter',
    enabled: true,
  },
  {
    name: 'Google AI',
    url: 'https://x.com/GoogleAI',
    type: 'twitter',
    enabled: true,
  },
  {
    name: 'Google DeepMind',
    url: 'http://x.com/googledeepmind',
    type: 'twitter',
    enabled: true,
  },
  {
    name: 'Gemini App',
    url: 'https://x.com/GeminiApp',
    type: 'twitter',
    enabled: true,
  },
  {
    name: 'Google Quantum AI',
    url: 'https://x.com/GoogleQuantumAI',
    type: 'twitter',
    enabled: true,
  },
  {
    name: 'Google AI Studio',
    url: 'https://x.com/GoogleAIStudio',
    type: 'twitter',
    enabled: true,
  },

  // YouTube Channels
  {
    name: 'Google Cloud Tech',
    url: 'UCJS9pqu9BzkAMNTmzNMNhvg',
    type: 'youtube',
    enabled: true,
  },
  {
    name: 'Google',
    url: 'UCK8sQmJBp8GCxrOtXWBpyEA',
    type: 'youtube',
    enabled: true,
  },
  {
    name: 'Google DeepMind',
    url: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
    type: 'youtube',
    enabled: true,
  },

  // RSS/Blog Sources
  {
    name: 'Medium Google Cloud',
    url: 'http://www.medium.com/feed/google-cloud',
    type: 'rss',
    enabled: true,
  },
  {
    name: 'Google DeepMind Blog',
    url: 'https://blog.google/innovation-and-ai/models-and-research/google-deepmind/rss/',
    type: 'rss',
    enabled: true,
  },
  {
    name: 'Google Research Blog',
    url: 'https://blog.google/innovation-and-ai/models-and-research/google-research/rss/',
    type: 'rss',
    enabled: true,
  },
  {
    name: 'Google Labs Blog',
    url: 'https://blog.google/innovation-and-ai/models-and-research/google-labs/rss/',
    type: 'rss',
    enabled: true,
  },
  {
    name: 'Google DevTools Blog',
    url: 'https://blog.google/innovation-and-ai/technology/developers-tools/rss/',
    type: 'rss',
    enabled: true,
  },
  {
    name: 'Google Gemini Blog',
    url: 'https://blog.google/products-and-platforms/products/gemini/rss/',
    type: 'rss',
    enabled: true,
  },
  {
    name: 'Android Blog',
    url: 'https://blog.google/products-and-platforms/platforms/android/rss/',
    type: 'rss',
    enabled: true,
  },
  {
    name: 'Google Cloud Blog',
    url: 'https://blog.google/innovation-and-ai/infrastructure-and-cloud/google-cloud/rss/',
    type: 'rss',
    enabled: true,
  },
];
