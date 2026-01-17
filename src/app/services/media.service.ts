import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UserSettingsService } from './user-settings.service';
import { I18nService } from '../i18n';

interface ImageGenerationResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          mimeType: string;
          data: string;
        };
      }>;
    };
  }>;
  error?: { message?: string };
}

interface VideoGenerationResponse {
  name?: string; // operation name
  error?: { message?: string };
}

interface VideoStatusResponse {
  done?: boolean;
  response?: {
    generateVideoResponse?: {
      generatedSamples?: Array<{
        video?: {
          uri?: string;
        };
      }>;
    };
  };
  error?: { message?: string };
}

export interface GeneratedMedia {
  type: 'image' | 'video';
  data?: string; // base64 for images
  url?: string;  // URL for videos
  mimeType?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  private http = inject(HttpClient);
  private userSettings = inject(UserSettingsService);
  private i18n = inject(I18nService);
  private readonly API_BASE = '/api/gemini';

  private getApiKey(): string {
    const apiKey = this.userSettings.getGeminiApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key não configurada. Configure em ⚙️ Configurações.');
    }
    return apiKey;
  }

  /**
   * Generate an image using Nano Banana (gemini-3-pro-image-preview)
   */
  async generateImage(prompt: string): Promise<GeneratedMedia> {
    // Add language instruction for any text in image
    const lang = this.i18n.getLanguageForPrompt();
    const enhancedPrompt = `${prompt}. IMPORTANT: Any text in the image must be in ${lang}.`;

    try {
      const response = await this.http.post<ImageGenerationResponse>(
        `${this.API_BASE}/generate-image`,
        { apiKey: this.getApiKey(), prompt: enhancedPrompt }
      ).toPromise();

      if (response?.error) {
        throw new Error(response.error.message || 'Image generation failed');
      }

      const part = response?.candidates?.[0]?.content?.parts?.[0];
      if (part?.inlineData) {
        return {
          type: 'image',
          data: part.inlineData.data,
          mimeType: part.inlineData.mimeType
        };
      }

      throw new Error('No image data in response');
    } catch (error) {
      console.error('Image generation error:', error);
      throw error;
    }
  }

  /**
   * Generate a video using Veo 3.1 (async with polling)
   */
  async generateVideo(
    prompt: string,
    onProgress?: (status: string) => void
  ): Promise<GeneratedMedia> {
    // Prompt in English for better model performance, with visual text in user's language
    const lang = this.i18n.getLanguageForPrompt();
    const enhancedPrompt = `${prompt}. IMPORTANT REQUIREMENTS: 1) Any on-screen text or graphics must be in ${lang}. 2) NO narration, NO dialogue, NO voices - only ambient sounds and music are allowed. 3) Keep visual style cinematic and professional.`;
    const apiKey = this.getApiKey();

    try {
      // Start video generation
      onProgress?.(this.i18n.t.content.startingVideo);

      const startResponse = await this.http.post<VideoGenerationResponse>(
        `${this.API_BASE}/generate-video`,
        { apiKey, prompt: enhancedPrompt }
      ).toPromise();

      if (startResponse?.error) {
        throw new Error(startResponse.error.message || 'Video generation failed to start');
      }

      const operationName = startResponse?.name;
      if (!operationName) {
        throw new Error('No operation name received');
      }

      // Poll for completion
      onProgress?.(this.i18n.t.content.generatingVideoMinutes);
      const videoUri = await this.pollVideoStatus(operationName, apiKey, onProgress);

      return {
        type: 'video',
        url: `/api/gemini/video-download?uri=${encodeURIComponent(videoUri)}&apiKey=${encodeURIComponent(apiKey)}`,
        mimeType: 'video/mp4'
      };
    } catch (error) {
      console.error('Video generation error:', error);
      throw error;
    }
  }

  private async pollVideoStatus(
    operationName: string,
    apiKey: string,
    onProgress?: (status: string) => void
  ): Promise<string> {
    const maxAttempts = 60; // 5 minutes max (5s intervals)
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;

      const statusResponse = await this.http.get<VideoStatusResponse>(
        `${this.API_BASE}/video-status/${encodeURIComponent(operationName)}?apiKey=${encodeURIComponent(apiKey)}`
      ).toPromise();

      if (statusResponse?.error) {
        throw new Error(statusResponse.error.message || 'Video status check failed');
      }

      if (statusResponse?.done) {
        const videoUri = statusResponse.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
        if (videoUri) {
          onProgress?.(this.i18n.t.content.videoSuccess);
          return videoUri;
        }
        throw new Error('Video completed but no URI found');
      }

      onProgress?.(`${this.i18n.t.content.generatingVideoProgress} (${attempts * 5}s)`);
      await this.sleep(5000);
    }

    throw new Error('Video generation timed out');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

