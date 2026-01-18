import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SyncService } from '../../services/sync.service';
import { GeminiService } from '../../services/gemini.service';
import { MediaService, GeneratedMedia } from '../../services/media.service';
import { GeneratedThread, ThreadTweet, FeedItem } from '../../models/feed.model';
import { I18nService } from '../../i18n';
import {
  Platform,
  PlatformSelection,
  PlatformContent,
  GeneratedContent,
  PLATFORMS,
  DEFAULT_PLATFORM_SELECTION
} from '../../models/platform-content.model';

@Component({
  selector: 'app-thread-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './thread-panel.component.html',
  styleUrl: './thread-panel.component.css'
})
export class ThreadPanelComponent {
  syncService = inject(SyncService);
  geminiService = inject(GeminiService);
  mediaService = inject(MediaService);
  i18n = inject(I18nService);

  // Platform configuration
  platforms = PLATFORMS;
  platformList: Platform[] = ['twitter', 'linkedin', 'threads', 'bluesky'];

  // Platform selection state
  platformSelection = signal<PlatformSelection>({ ...DEFAULT_PLATFORM_SELECTION });
  showPlatformDropdown = signal(false);
  activePlatformTab = signal<Platform>('twitter');

  // Generated content per platform
  generatedContent = signal<GeneratedContent>({});

  // Legacy thread support (will be migrated)
  thread = signal<GeneratedThread | null>(null);
  isGenerating = signal(false);
  error = signal<string | null>(null);
  copiedIndex = signal<number | null>(null);

  // Media generation state
  generatingMediaIndex = signal<number | null>(null);
  generatingMediaKey = signal<string | null>(null);  // For platform-indexed media (single)
  generatingMediaKeys = signal<Set<string>>(new Set());  // For concurrent generation tracking
  mediaProgress = signal<string>('');
  mediaProgressMap = signal<Map<string, string>>(new Map());  // Progress per key
  generatedMedia = signal<Map<number, GeneratedMedia>>(new Map());
  // Platform-indexed media storage: key = "platform_index"
  platformGeneratedMedia = signal<Map<string, GeneratedMedia>>(new Map());

  // Prompt editing state
  editingPromptIndex = signal<number | null>(null);
  editedPrompts = signal<Map<number, string>>(new Map());

  // URL context state
  showUrlInput = signal(false);
  additionalUrls = signal('');

  // Media Assets tab state
  showMediaTab = signal(false);
  generatedAssets = signal<Map<string, GeneratedMedia>>(new Map());
  usedItemsForMedia = signal<FeedItem[]>([]);  // Store items used in last generation

  // Adhoc content state
  showAdhocModal = signal(false);
  adhocUrl = signal('');
  adhocImageBase64 = signal<string | null>(null);
  adhocImagePreview = signal<string | null>(null);
  adhocError = signal<string | null>(null);
  adhocLoading = signal(false);

  get selectedItems() {
    return this.syncService.selectedItems;
  }

  get selectedCount() {
    return this.syncService.selectedCount;
  }

  async generateThread(): Promise<void> {
    const items = this.selectedItems();
    if (items.length === 0) return;

    this.isGenerating.set(true);
    this.error.set(null);
    this.generatedMedia.set(new Map()); // Clear previous media

    // Parse additional URLs
    const urlsText = this.additionalUrls().trim();
    const additionalUrls = urlsText ? urlsText.split('\n').map(u => u.trim()).filter(u => u) : [];

    try {
      const result = await this.geminiService.generateThread(items, additionalUrls);
      this.thread.set(result);
      // Mark selected items as used after successful generation
      this.syncService.markSelectedAsUsed();
    } catch (err: any) {
      this.error.set(err.message || 'Erro ao gerar thread');
    } finally {
      this.isGenerating.set(false);
    }
  }

  async regenerateTweet(index: number): Promise<void> {
    const currentThread = this.thread();
    if (!currentThread) return;

    try {
      const newTweet = await this.geminiService.regenerateTweet(currentThread, index);
      this.thread.update(t => {
        if (!t) return t;
        return {
          ...t,
          tweets: t.tweets.map(tweet =>
            tweet.index === index ? newTweet : tweet
          )
        };
      });
    } catch (err) {
      console.error('Error regenerating tweet:', err);
    }
  }

  async generateMedia(tweet: ThreadTweet): Promise<void> {
    if (!tweet.mediaPlaceholder) return;

    const { type } = tweet.mediaPlaceholder;
    // Use edited prompt if available, otherwise use original
    const prompt = this.getEditedPrompt(tweet.index) || tweet.mediaPlaceholder.prompt;
    const key = `twitter_${tweet.index}`;

    this.generatingMediaIndex.set(tweet.index);
    // Add to concurrent tracking Set
    this.generatingMediaKeys.update(set => {
      const newSet = new Set(set);
      newSet.add(key);
      return newSet;
    });
    this.mediaProgress.set('');

    try {
      let media: GeneratedMedia;

      if (type === 'image') {
        this.mediaProgress.set(this.i18n.t.content.generatingImage);
        media = await this.mediaService.generateImage(prompt);
      } else {
        media = await this.mediaService.generateVideo(prompt, (status) => {
          this.mediaProgress.set(status);
        });
      }

      this.generatedMedia.update(map => {
        const newMap = new Map(map);
        newMap.set(tweet.index, media);
        return newMap;
      });

    } catch (err: any) {
      console.error('Media generation error:', err);
      this.mediaProgress.set(`Erro: ${err.message}`);
    } finally {
      this.generatingMediaIndex.set(null);
      // Remove from concurrent tracking Set
      this.generatingMediaKeys.update(set => {
        const newSet = new Set(set);
        newSet.delete(key);
        return newSet;
      });
    }
  }

  // Prompt editing methods
  isEditingPrompt(index: number): boolean {
    return this.editingPromptIndex() === index;
  }

  getEditedPrompt(index: number): string | undefined {
    return this.editedPrompts().get(index);
  }

  toggleEditPrompt(index: number): void {
    if (this.editingPromptIndex() === index) {
      this.editingPromptIndex.set(null);
    } else {
      this.editingPromptIndex.set(index);
    }
  }

  updateEditedPrompt(index: number, event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.editedPrompts.update(map => {
      const newMap = new Map(map);
      newMap.set(index, value);
      return newMap;
    });
  }

  saveEditPrompt(index: number): void {
    this.editingPromptIndex.set(null);
  }

  cancelEditPrompt(index: number): void {
    this.editedPrompts.update(map => {
      const newMap = new Map(map);
      newMap.delete(index);
      return newMap;
    });
    this.editingPromptIndex.set(null);
  }

  getGeneratedMedia(index: number): GeneratedMedia | undefined {
    return this.generatedMedia().get(index);
  }

  isGeneratingMedia(index: number): boolean {
    // Check both old single index and new Set for concurrent tracking
    return this.generatingMediaIndex() === index || this.generatingMediaKeys().has(`twitter_${index}`);
  }

  downloadMedia(media: GeneratedMedia, tweetIndex: number): void {
    if (media.type === 'image' && media.data) {
      const link = document.createElement('a');
      link.href = `data:${media.mimeType};base64,${media.data}`;
      link.download = `tweet_${tweetIndex}_image.png`;
      link.click();
    } else if (media.type === 'video' && media.url) {
      const link = document.createElement('a');
      link.href = media.url;
      link.download = `tweet_${tweetIndex}_video.mp4`;
      link.click();
    }
  }

  clearGeneratedMedia(index: number): void {
    this.generatedMedia.update(map => {
      const newMap = new Map(map);
      newMap.delete(index);
      return newMap;
    });
    // This will show the placeholder again, allowing prompt editing
  }

  copyTweet(tweet: ThreadTweet): void {
    navigator.clipboard.writeText(tweet.content).then(() => {
      this.copiedIndex.set(tweet.index);
      setTimeout(() => this.copiedIndex.set(null), 2000);
    });
  }

  copyThread(): void {
    const thread = this.thread();
    if (!thread) return;

    const fullText = thread.tweets
      .map((t, i) => `${i + 1}/${thread.tweets.length}\n${t.content}`)
      .join('\n\n---\n\n');

    navigator.clipboard.writeText(fullText).then(() => {
      this.copiedIndex.set(-1); // -1 indicates full thread copied
      setTimeout(() => this.copiedIndex.set(null), 2000);
    });
  }

  clearThread(): void {
    this.thread.set(null);
    this.error.set(null);
    this.generatedMedia.set(new Map());
  }

  getCharCount(content: string): number {
    return content.length;
  }

  getCharCountClass(count: number): string {
    if (count > 280) return 'over';
    if (count > 260) return 'warning';
    return 'ok';
  }

  getMediaIcon(type: 'image' | 'video'): string {
    return type === 'image' ? '🖼️' : '🎬';
  }

  getToolLabel(tool: 'veo3' | 'nanobanana'): string {
    return tool === 'veo3' ? 'Veo 3.1' : 'Nano Banana';
  }

  // URL context methods
  toggleUrlInput(): void {
    this.showUrlInput.update(v => !v);
  }

  updateAdditionalUrls(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.additionalUrls.set(value);
  }

  // Platform selection methods
  togglePlatformDropdown(): void {
    this.showPlatformDropdown.update(v => !v);
  }

  closePlatformDropdown(): void {
    this.showPlatformDropdown.set(false);
  }

  togglePlatform(platform: Platform): void {
    this.platformSelection.update(sel => ({
      ...sel,
      [platform]: !sel[platform]
    }));
  }

  isPlatformSelected(platform: Platform): boolean {
    return this.platformSelection()[platform];
  }

  getSelectedPlatforms(): Platform[] {
    const sel = this.platformSelection();
    return this.platformList.filter(p => sel[p]);
  }

  getSelectedPlatformCount(): number {
    return this.getSelectedPlatforms().length;
  }

  setActivePlatformTab(platform: Platform): void {
    this.activePlatformTab.set(platform);
  }

  getPlatformIcon(platform: Platform): string {
    return this.platforms[platform].icon;
  }

  getPlatformName(platform: Platform): string {
    return this.platforms[platform].name;
  }

  // Generate content for selected platforms
  async generateContent(): Promise<void> {
    const items = this.selectedItems();
    const selectedPlatforms = this.getSelectedPlatforms();

    if (items.length === 0 || selectedPlatforms.length === 0) return;

    this.isGenerating.set(true);
    this.error.set(null);
    this.generatedMedia.set(new Map());
    this.generatedContent.set({});
    this.thread.set(null);

    // Store items reference for Media tab (before marking as used)
    this.usedItemsForMedia.set([...items]);

    // Parse additional URLs
    const urlsText = this.additionalUrls().trim();
    const additionalUrls = urlsText ? urlsText.split('\n').map(u => u.trim()).filter(u => u) : [];

    try {
      // Generate content for all selected platforms in parallel
      const generationPromises = selectedPlatforms.map(async (platform) => {
        if (platform === 'twitter') {
          // Legacy Twitter thread generation
          const result = await this.geminiService.generateThread(items, additionalUrls);
          this.thread.set(result);
          return { platform, success: true };
        } else {
          // New platform-specific generation
          const content = await this.geminiService.generateContentForPlatform(platform, items, additionalUrls);
          this.generatedContent.update(gc => ({
            ...gc,
            [platform]: content
          }));
          return { platform, success: true };
        }
      });

      await Promise.all(generationPromises);

      // Set active tab to first selected platform
      this.activePlatformTab.set(selectedPlatforms[0]);

      // Mark selected items as used after successful generation
      this.syncService.markSelectedAsUsed();
    } catch (err: any) {
      this.error.set(err.message || 'Error generating content');
    } finally {
      this.isGenerating.set(false);
    }
  }

  // Get content for a specific platform
  getPlatformContent(platform: Platform): PlatformContent | undefined {
    return this.generatedContent()[platform];
  }

  // Check if platform has content
  hasPlatformContent(platform: Platform): boolean {
    if (platform === 'twitter') {
      return !!this.thread();
    }
    return !!this.generatedContent()[platform];
  }

  // Copy all platform content to clipboard
  copyPlatformContent(): void {
    const platform = this.activePlatformTab();
    const content = this.getPlatformContent(platform);
    if (!content) return;

    const text = content.posts.map((post, i) => {
      let postText = `[${i + 1}/${content.posts.length}]\n${post.text}`;
      if (post.linkReference) {
        postText += `\n\n🔗 ${post.linkReference}`;
      }
      return postText;
    }).join('\n\n---\n\n');

    navigator.clipboard.writeText(text);
    this.copiedIndex.set(-1);
    setTimeout(() => this.copiedIndex.set(-99), 2000);
  }

  // Copy single post text
  copyPostText(text: string, index: number): void {
    navigator.clipboard.writeText(text);
    this.copiedIndex.set(index);
    setTimeout(() => this.copiedIndex.set(-99), 2000);
  }

  // Clear all generated content
  clearAllContent(): void {
    this.thread.set(null);
    this.generatedContent.set({});
    this.generatedMedia.set(new Map());
    this.platformGeneratedMedia.set(new Map());
  }

  // Platform-indexed media methods
  private getPlatformMediaKey(platform: Platform, index: number): string {
    return `${platform}_${index}`;
  }

  getGeneratedMediaForPlatform(platform: Platform, index: number): GeneratedMedia | undefined {
    const key = this.getPlatformMediaKey(platform, index);
    return this.platformGeneratedMedia().get(key);
  }

  isGeneratingMediaForPlatform(platform: Platform, index: number): boolean {
    const key = this.getPlatformMediaKey(platform, index);
    return this.generatingMediaKeys().has(key);
  }

  async generateMediaForPlatform(post: { text: string; mediaPlaceholder?: string }, platform: Platform, index: number): Promise<void> {
    if (!post.mediaPlaceholder) return;

    const key = this.getPlatformMediaKey(platform, index);

    // Add to concurrent tracking Set
    this.generatingMediaKeys.update(set => {
      const newSet = new Set(set);
      newSet.add(key);
      return newSet;
    });
    this.mediaProgress.set(this.i18n.t.content.generatingImage || 'Generating image...');

    try {
      const result = await this.mediaService.generateImage(post.mediaPlaceholder);

      if (result) {
        this.platformGeneratedMedia.update(media => {
          const newMedia = new Map(media);
          newMedia.set(key, result);
          return newMedia;
        });
      }
    } catch (error) {
      console.error('Error generating media for platform:', error);
    } finally {
      // Remove from concurrent tracking Set
      this.generatingMediaKeys.update(set => {
        const newSet = new Set(set);
        newSet.delete(key);
        return newSet;
      });
      this.mediaProgress.set('');
    }
  }

  downloadMediaForPlatform(media: GeneratedMedia, platform: Platform, index: number): void {
    const link = document.createElement('a');
    if (media.type === 'image' && media.data) {
      link.href = `data:${media.mimeType};base64,${media.data}`;
      link.download = `${platform}_post_${index + 1}_image.png`;
    } else if (media.url) {
      link.href = media.url;
      link.download = `${platform}_post_${index + 1}_video.mp4`;
    }
    link.click();
  }

  clearGeneratedMediaForPlatform(platform: Platform, index: number): void {
    const key = this.getPlatformMediaKey(platform, index);
    this.platformGeneratedMedia.update(media => {
      const newMedia = new Map(media);
      newMedia.delete(key);
      return newMedia;
    });
  }

  // Media Assets Tab methods
  hasAnyContent(): boolean {
    return !!this.thread() || Object.keys(this.generatedContent()).length > 0;
  }

  // Collect all media prompts from all platforms
  getAllMediaPrompts(): { type: 'image' | 'video'; prompt: string; platform: string; postIndex: number; key: string }[] {
    const prompts: { type: 'image' | 'video'; prompt: string; platform: string; postIndex: number; key: string }[] = [];

    // From Twitter thread
    const thread = this.thread();
    if (thread) {
      thread.tweets.forEach(tweet => {
        if (tweet.mediaPlaceholder) {
          prompts.push({
            type: tweet.mediaPlaceholder.type,
            prompt: tweet.mediaPlaceholder.prompt,
            platform: 'Twitter',
            postIndex: tweet.index,
            key: `twitter_${tweet.index}`
          });
        }
      });
    }

    // From other platforms
    const content = this.generatedContent();
    for (const [platform, platformContent] of Object.entries(content)) {
      if (platformContent?.posts) {
        platformContent.posts.forEach((post: { text: string; mediaPlaceholder?: string }, idx: number) => {
          if (post.mediaPlaceholder) {
            // Detect type from placeholder content
            const isVideo = post.mediaPlaceholder.toLowerCase().includes('[video]');
            prompts.push({
              type: isVideo ? 'video' : 'image',
              prompt: this.cleanMediaPrompt(post.mediaPlaceholder),
              platform: this.getPlatformName(platform as Platform),
              postIndex: idx + 1,
              key: `${platform}_${idx}`
            });
          }
        });
      }
    }

    return prompts;
  }

  // Clean [IMAGE]/[VIDEO] prefixes from prompts
  private cleanMediaPrompt(prompt: string): string {
    return prompt
      .replace(/^\[IMAGE\]:\s*/i, '')
      .replace(/^\[VIDEO\]:\s*/i, '')
      .replace(/^\[image\]:\s*/i, '')
      .replace(/^\[video\]:\s*/i, '')
      .trim();
  }

  // Get original media from feed items used in generation
  getOriginalMedia(): { type: 'image' | 'video'; url: string; source: string }[] {
    const media: { type: 'image' | 'video'; url: string; source: string }[] = [];
    const seenUrls = new Set<string>();
    const seenMediumIds = new Set<string>();

    // Extract Medium image unique ID
    const getMediumImageId = (url: string): string | null => {
      // Match patterns like "1*K7BmzAA_q1xg8v0pHdpsYg" 
      const match = url.match(/\/(\d\*[A-Za-z0-9_-]+)\./);
      return match ? match[1] : null;
    };

    // Use stored items from last generation (not selectedItems which may be cleared)
    const items = this.usedItemsForMedia();
    items.forEach(item => {
      if (item.mediaUrls && item.mediaUrls.length > 0) {
        item.mediaUrls.forEach(url => {
          // Skip if exact URL already seen
          if (seenUrls.has(url)) return;

          // Skip Medium logos and branding images
          if (url.includes('miro.medium.com')) {
            // Skip if no unique image ID (likely a logo/icon)
            const mediumId = getMediumImageId(url);
            if (!mediumId) return; // No unique ID = likely a logo

            // Dedupe by image ID (same image, different sizes)
            if (seenMediumIds.has(mediumId)) return;
            seenMediumIds.add(mediumId);
          }

          seenUrls.add(url);
          // Check for actual video file extensions, not just 'video' in URL path
          const isVideo = /\.(mp4|webm|mov|avi|mkv)($|\?)/.test(url.toLowerCase());
          media.push({
            type: isVideo ? 'video' : 'image',
            url,
            source: item.feedName
          });
        });
      }
    });

    return media;
  }

  // Asset generation methods
  getGeneratedAsset(key: string): GeneratedMedia | undefined {
    return this.generatedAssets().get(key) || this.platformGeneratedMedia().get(key);
  }

  isGeneratingAsset(key: string): boolean {
    return this.generatingMediaKey() === key;
  }

  async generateAsset(prompt: { type: 'image' | 'video'; prompt: string; key: string }): Promise<void> {
    this.generatingMediaKey.set(prompt.key);

    if (prompt.type === 'image') {
      this.mediaProgress.set(this.i18n.t.media.generatingImage || 'Generating image...');
      try {
        const result = await this.mediaService.generateImage(prompt.prompt);
        if (result) {
          this.generatedAssets.update(assets => {
            const newAssets = new Map(assets);
            newAssets.set(prompt.key, result);
            return newAssets;
          });
        }
      } catch (e) {
        console.error('Error generating image:', e);
      }
    } else {
      this.mediaProgress.set(this.i18n.t.media.generatingVideo || 'Generating video...');
      try {
        const result = await this.mediaService.generateVideo(prompt.prompt, (progress) => {
          this.mediaProgress.set(progress);
        });
        if (result) {
          this.generatedAssets.update(assets => {
            const newAssets = new Map(assets);
            newAssets.set(prompt.key, result);
            return newAssets;
          });
        }
      } catch (e) {
        console.error('Error generating video:', e);
      }
    }

    this.generatingMediaKey.set(null);
    this.mediaProgress.set('');
  }

  downloadAsset(asset: GeneratedMedia, prompt: { platform: string; postIndex: number; type: string }): void {
    const link = document.createElement('a');
    if (asset.type === 'image' && asset.data) {
      link.href = `data:${asset.mimeType};base64,${asset.data}`;
      link.download = `${prompt.platform}_post${prompt.postIndex}_image.png`;
    } else if (asset.url) {
      link.href = asset.url;
      link.download = `${prompt.platform}_post${prompt.postIndex}_video.mp4`;
    }
    link.click();
  }

  downloadOriginalMedia(media: { type: string; url: string; source: string }): void {
    window.open(media.url, '_blank');
  }

  // Adhoc content methods
  closeAdhocModal(): void {
    this.showAdhocModal.set(false);
    this.adhocUrl.set('');
    this.adhocImageBase64.set(null);
    this.adhocImagePreview.set(null);
    this.adhocError.set(null);
    this.adhocLoading.set(false);
  }

  clearAdhocImage(): void {
    this.adhocImageBase64.set(null);
    this.adhocImagePreview.set(null);
  }

  onAdhocImageSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.processAdhocImage(input.files[0]);
    }
  }

  onAdhocImageDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      this.processAdhocImage(event.dataTransfer.files[0]);
    }
  }

  private processAdhocImage(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      this.adhocImagePreview.set(result);
      // Extract base64 data without the data URL prefix
      this.adhocImageBase64.set(result);
    };
    reader.readAsDataURL(file);
  }

  async generateAdhocContent(): Promise<void> {
    const url = this.adhocUrl().trim();
    const imageBase64 = this.adhocImageBase64();

    if (!url && !imageBase64) {
      this.adhocError.set(this.i18n.t.adhoc.errorNoInput);
      return;
    }

    this.adhocLoading.set(true);
    this.adhocError.set(null);

    try {
      const result = await this.geminiService.generateFromAdhoc(
        url || undefined,
        imageBase64 || undefined
      );

      // Set the thread and close modal
      this.thread.set(result);
      this.activePlatformTab.set('twitter');
      this.closeAdhocModal();

    } catch (error: any) {
      if (error.message === 'URL_NOT_ACCESSIBLE') {
        this.adhocError.set(this.i18n.t.adhoc.errorUrlNotAccessible);
      } else if (error.message === 'NO_INPUT') {
        this.adhocError.set(this.i18n.t.adhoc.errorNoInput);
      } else {
        this.adhocError.set(this.i18n.t.adhoc.errorGeneration);
      }
    } finally {
      this.adhocLoading.set(false);
    }
  }
}
