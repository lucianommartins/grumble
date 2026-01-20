import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from parent directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve Angular static files in production
if (process.env.NODE_ENV === 'production') {
  const angularDistPath = join(__dirname, '..', 'dist', 'grumble', 'browser');
  app.use(express.static(angularDistPath));
}

// Twitter API proxy configuration
const TWITTER_API_BASE = 'https://api.twitter.com/2';
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasTwitterToken: !!TWITTER_BEARER_TOKEN,
    hasGeminiKey: !!GEMINI_API_KEY
  });
});

// Gemini API key validation endpoint
app.post('/api/gemini/validate-key', async (req, res) => {
  const { apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({
      valid: false,
      error: 'API key not provided'
    });
  }

  try {
    // Test with a minimal request to check if the key is valid
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'test' }] }],
        generationConfig: { maxOutputTokens: 1 }
      })
    });

    const data = await response.json();

    if (response.status === 200 && data.candidates) {
      return res.json({ valid: true });
    } else if (data.error) {
      return res.json({
        valid: false,
        error: data.error.message || 'Invalid API key'
      });
    } else {
      return res.json({ valid: false, error: 'Unknown error' });
    }
  } catch (error) {
    console.error('API key validation error:', error);
    return res.status(500).json({
      valid: false,
      error: error.message || 'Validation failed'
    });
  }
});

// Twitter bearer token validation endpoint
app.post('/api/twitter/validate-token', async (req, res) => {
  const { bearerToken } = req.body;

  if (!bearerToken) {
    return res.status(400).json({
      valid: false,
      error: 'Bearer token not provided'
    });
  }

  try {
    // Test with a simple request - lookup @Twitter user (always exists, works with App-Only)
    const response = await fetch('https://api.twitter.com/2/users/by/username/Twitter', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (response.status === 200 && data.data) {
      return res.json({ valid: true });
    } else if (response.status === 401 || response.status === 403) {
      return res.json({
        valid: false,
        error: 'Bearer Token inválido ou expirado'
      });
    } else if (data.errors || data.detail) {
      return res.json({
        valid: false,
        error: data.errors?.[0]?.message || data.detail || 'Invalid bearer token'
      });
    } else {
      return res.json({ valid: false, error: 'Unknown error' });
    }
  } catch (error) {
    console.error('Bearer token validation error:', error);
    return res.status(500).json({
      valid: false,
      error: error.message || 'Validation failed'
    });
  }
});


app.post('/api/gemini/generate', async (req, res) => {
  const { apiKey, model, contents, config: genConfig, tools } = req.body;

  if (!apiKey) {
    return res.status(400).json({
      error: 'Gemini API key not provided',
      message: 'Please configure your Gemini API key in Settings'
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Build request body
  const requestBody = {
    contents: [{ parts: [{ text: contents }] }],
    generationConfig: genConfig
  };

  // Add tools if provided (e.g., for URL context)
  if (tools && tools.length > 0) {
    requestBody.tools = tools;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    res.status(response.status).json(data);

  } catch (error) {
    console.error('Gemini API error:', error);
    res.status(500).json({
      error: 'Failed to fetch from Gemini API',
      message: error.message
    });
  }
});

// Gemini API proxy - Image generation (Nano Banana)
app.post('/api/gemini/generate-image', async (req, res) => {
  const { apiKey, prompt } = req.body;

  if (!apiKey) {
    return res.status(400).json({
      error: 'Gemini API key not provided',
      message: 'Please configure your Gemini API key in Settings'
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE']
        }
      })
    });

    const data = await response.json();
    res.status(response.status).json(data);

  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({
      error: 'Failed to generate image',
      message: error.message
    });
  }
});

// Gemini API proxy - Video generation start (Veo 3.1)
app.post('/api/gemini/generate-video', async (req, res) => {
  const { apiKey, prompt } = req.body;

  if (!apiKey) {
    return res.status(400).json({
      error: 'Gemini API key not provided',
      message: 'Please configure your Gemini API key in Settings'
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{ prompt }]
      })
    });

    const data = await response.json();
    res.status(response.status).json(data);

  } catch (error) {
    console.error('Video generation error:', error);
    res.status(500).json({
      error: 'Failed to start video generation',
      message: error.message
    });
  }
});

// Gemini API proxy - Check video generation status
app.get('/api/gemini/video-status/:operationName', async (req, res) => {
  const { apiKey } = req.query;

  if (!apiKey) {
    return res.status(400).json({
      error: 'Gemini API key not provided'
    });
  }

  const { operationName } = req.params;
  const url = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();
    res.status(response.status).json(data);

  } catch (error) {
    console.error('Video status check error:', error);
    res.status(500).json({
      error: 'Failed to check video status',
      message: error.message
    });
  }
});

// Gemini API proxy - Download video
app.get('/api/gemini/video-download', async (req, res) => {
  const { uri, apiKey } = req.query;

  if (!apiKey) {
    return res.status(400).json({ error: 'Gemini API key not provided' });
  }

  if (!uri) {
    return res.status(400).json({ error: 'Missing video URI' });
  }

  try {
    // Use header authentication as per API docs
    const response = await fetch(uri, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      console.error('Video download failed:', response.status, await response.text());
      return res.status(response.status).json({ error: 'Failed to download video' });
    }

    const contentType = response.headers.get('content-type') || 'video/mp4';
    res.set('Content-Type', contentType);
    res.set('Content-Disposition', 'inline');

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('Video download error:', error);
    res.status(500).json({
      error: 'Failed to download video',
      message: error.message
    });
  }
});

// Twitter API proxy
app.all('/api/twitter/*', async (req, res) => {
  // Get bearer token from custom header or from body
  const bearerToken = req.headers['x-twitter-bearer-token'] || req.body?.bearerToken;

  if (!bearerToken) {
    return res.status(400).json({
      error: 'Twitter bearer token not provided',
      message: 'Please configure your Twitter Bearer Token in Settings'
    });
  }

  const twitterPath = req.path.replace('/api/twitter', '');
  const url = `${TWITTER_API_BASE}${twitterPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });

    const data = await response.json();

    // Forward Twitter's rate limit headers
    const rateLimitHeaders = ['x-rate-limit-limit', 'x-rate-limit-remaining', 'x-rate-limit-reset'];
    rateLimitHeaders.forEach(header => {
      const value = response.headers.get(header);
      if (value) res.set(header, value);
    });

    res.status(response.status).json(data);

  } catch (error) {
    console.error('Twitter API error:', error);
    res.status(500).json({
      error: 'Failed to fetch from Twitter API',
      message: error.message
    });
  }
});

// SPA fallback - serve index.html for all non-API routes (must be after API routes)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    const angularDistPath = join(__dirname, '..', 'dist', 'grumble', 'browser');
    res.sendFile(join(angularDistPath, 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`🔥 Grumble API Server running on http://localhost:${PORT}`);
  console.log(`📡 Twitter API proxy: http://localhost:${PORT}/api/twitter/*`);
  console.log(`🤖 Gemini API proxy: http://localhost:${PORT}/api/gemini/*`);
});
