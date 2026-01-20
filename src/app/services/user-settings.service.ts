import { Injectable, inject, signal, effect } from '@angular/core';
import { Firestore, doc, setDoc, getDocFromServer } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { CryptoService } from './crypto.service';
import { LoggerService } from './logger.service';

export interface UserSettings {
  twitterBearerToken?: string;
  geminiApiKey?: string;
  githubPat?: string;  // GitHub Personal Access Token for Issues/Discussions
}

// Internal encrypted format stored in Firestore
interface EncryptedSettings {
  encryptedGeminiApiKey?: string;
  encryptedTwitterToken?: string;
  encryptedGithubPat?: string;
  encryptionVersion: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserSettingsService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private crypto = inject(CryptoService);
  private logger = inject(LoggerService);

  settings = signal<UserSettings | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);

  private currentUserId: string | null = null;
  private loadingPromise: Promise<void> | null = null;

  // Current encryption version
  private readonly ENCRYPTION_VERSION = 1;

  constructor() {
    // Load settings when user changes
    effect(() => {
      const user = this.authService.currentUser();
      if (user && user.uid !== this.currentUserId) {
        this.currentUserId = user.uid;
        // Use setTimeout to avoid signal write in effect
        setTimeout(() => this.loadSettings(user.uid), 0);
      } else if (!user) {
        this.currentUserId = null;
        this.settings.set(null);
        this.isLoading.set(false);
      }
    });
  }

  private async loadSettings(userId: string): Promise<void> {
    // Prevent concurrent loads
    if (this.loadingPromise) return;

    this.logger.debug('UserSettings', 'Loading encrypted settings');
    this.error.set(null);

    this.loadingPromise = (async () => {
      try {
        const docRef = doc(this.firestore, `users/${userId}/settings/apiKeys`);
        const docSnap = await getDocFromServer(docRef);

        if (docSnap.exists()) {
          const encrypted = docSnap.data() as EncryptedSettings;
          this.logger.debug('UserSettings', 'Encrypted settings loaded, decrypting...');

          const decrypted = await this.decryptSettings(encrypted);
          this.settings.set(decrypted);
          this.logger.debug('UserSettings', 'Settings decrypted successfully');
        } else {
          this.logger.debug('UserSettings', 'No settings found, using empty');
          this.settings.set({});
        }
      } catch (err: any) {
        this.logger.error('UserSettings', 'Error loading/decrypting settings:', err);
        // Don't block - just use empty settings so user can save
        this.settings.set({});
      } finally {
        this.logger.debug('UserSettings', 'Load complete');
        this.loadingPromise = null;
      }
    })();

    await this.loadingPromise;
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Encrypt settings before saving
      const encrypted = await this.encryptSettings(settings);

      const docRef = doc(this.firestore, `users/${user.uid}/settings/apiKeys`);
      await setDoc(docRef, encrypted, { merge: true });

      // Update local state with decrypted values
      this.settings.set({ ...this.settings(), ...settings });
      this.logger.info('UserSettings', 'Encrypted settings saved successfully');
    } catch (err: any) {
      this.logger.error('UserSettings', 'Error saving encrypted settings:', err);
      this.error.set(err.message || 'Error saving settings');
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  private async encryptSettings(settings: UserSettings): Promise<EncryptedSettings> {
    const encrypted: EncryptedSettings = {
      encryptionVersion: this.ENCRYPTION_VERSION
    };

    if (settings.geminiApiKey) {
      encrypted.encryptedGeminiApiKey = await this.crypto.encrypt(settings.geminiApiKey);
    }

    if (settings.twitterBearerToken) {
      encrypted.encryptedTwitterToken = await this.crypto.encrypt(settings.twitterBearerToken);
    }

    if (settings.githubPat) {
      encrypted.encryptedGithubPat = await this.crypto.encrypt(settings.githubPat);
    }

    return encrypted;
  }

  private async decryptSettings(encrypted: EncryptedSettings): Promise<UserSettings> {
    const settings: UserSettings = {};

    if (encrypted.encryptedGeminiApiKey) {
      try {
        settings.geminiApiKey = await this.crypto.decrypt(encrypted.encryptedGeminiApiKey);
      } catch (err) {
        this.logger.warn('UserSettings', 'Failed to decrypt Gemini API key');
      }
    }

    if (encrypted.encryptedTwitterToken) {
      try {
        settings.twitterBearerToken = await this.crypto.decrypt(encrypted.encryptedTwitterToken);
      } catch (err) {
        this.logger.warn('UserSettings', 'Failed to decrypt Twitter token');
      }
    }

    if (encrypted.encryptedGithubPat) {
      try {
        settings.githubPat = await this.crypto.decrypt(encrypted.encryptedGithubPat);
      } catch (err) {
        this.logger.warn('UserSettings', 'Failed to decrypt GitHub PAT');
      }
    }

    return settings;
  }

  hasApiKeys(): boolean {
    const s = this.settings();
    return !!(s?.twitterBearerToken && s?.geminiApiKey);
  }

  hasGeminiApiKey(): boolean {
    return !!this.settings()?.geminiApiKey;
  }

  hasTwitterBearerToken(): boolean {
    return !!this.settings()?.twitterBearerToken;
  }

  getTwitterBearerToken(): string | undefined {
    return this.settings()?.twitterBearerToken;
  }

  getGeminiApiKey(): string | undefined {
    return this.settings()?.geminiApiKey;
  }

  getGithubPat(): string | undefined {
    return this.settings()?.githubPat;
  }

  hasGithubPat(): boolean {
    return !!this.settings()?.githubPat;
  }
}
