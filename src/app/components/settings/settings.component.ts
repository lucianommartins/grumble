import { Component, inject, signal, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { UserSettingsService, UserSettings } from '../../services/user-settings.service';
import { I18nService, SupportedLocale } from '../../i18n';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-overlay" (click)="close.emit()">
      <div class="settings-modal" (click)="$event.stopPropagation()">
        <div class="settings-header">
          <h2>{{ i18n.t.settings.title }}</h2>
          <button class="close-btn" (click)="close.emit()">✕</button>
        </div>

        <div class="settings-content">
          <p class="settings-info">
            {{ i18n.t.settings.description }}
          </p>

          <div class="form-group">
            <label for="geminiKey">{{ i18n.t.settings.geminiApiKey }} <span class="required">*{{ i18n.t.common.required }}</span></label>
            <input 
              type="password" 
              id="geminiKey"
              [(ngModel)]="geminiApiKey"
              placeholder="AIzaSy..."
              class="form-input"
              [class.input-error]="!geminiApiKey"
            />
            <p class="form-hint">
              {{ i18n.t.settings.geminiHint }} <a href="https://aistudio.google.com/app/apikey" target="_blank">{{ i18n.t.settings.geminiLinkText }}</a>
            </p>
          </div>

          <div class="form-group">
            <label for="githubPat">🐙 GitHub Personal Access Token <span class="required">*{{ i18n.t.common.required }}</span></label>
            <input
              type="password"
              id="githubPat"
              [(ngModel)]="githubPat"
              placeholder="ghp_..."
              class="form-input"
              [class.input-error]="!githubPat"
            />
            <p class="form-hint">
              Get it from <a href="https://github.com/settings/tokens" target="_blank">GitHub Settings</a>. Required for GitHub Issues/Discussions.
            </p>
          </div>

          <div class="form-group">
            <label for="twitterToken">{{ i18n.t.settings.twitterBearerToken }} <span class="optional">({{ i18n.t.common.optional }})</span></label>
            <input 
              type="password" 
              id="twitterToken"
              [(ngModel)]="twitterBearerToken"
              placeholder="AAAA..."
              class="form-input"
            />
            <p class="form-hint">
              {{ i18n.t.settings.twitterHint }} <a href="https://developer.twitter.com/" target="_blank">{{ i18n.t.settings.twitterLinkText }}</a>{{ i18n.t.settings.twitterHintSuffix }}
            </p>
          </div>

          <div class="form-group">
            <label for="language">🌐 {{ i18n.t.settings.language }}</label>
            <div class="language-selector">
              @for (option of i18n.localeOptions; track option.code) {
              <button 
                class="language-option" 
                [class.active]="i18n.getLocale() === option.code"
                (click)="setLanguage(option.code)"
              >
                <span class="flag">{{ option.flag }}</span>
                <span class="lang-name">{{ option.name }}</span>
              </button>
              }
            </div>
          </div>

          @if (validationError()) {
          <div class="error-message">
            ⚠️ {{ validationError() }}
          </div>
          }

          @if (settingsService.error()) {
          <div class="error-message">
            ⚠️ {{ settingsService.error() }}
          </div>
          }

          @if (saveSuccess()) {
          <div class="success-message">
            {{ i18n.t.settings.savedSuccess }}
          </div>
          }
        </div>

        <div class="settings-footer">
          <button class="btn btn-ghost" (click)="close.emit()">{{ i18n.t.common.cancel }}</button>
          <button 
            class="btn btn-primary" 
            (click)="save()"
            [disabled]="settingsService.isLoading() || isValidating() || !geminiApiKey || !githubPat"
          >
            {{ isValidating() ? i18n.t.common.validating : (settingsService.isLoading() ? i18n.t.common.saving : i18n.t.common.save) }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .settings-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }

    .settings-modal {
      background: var(--color-bg-card);
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-border);
      width: 100%;
      max-width: 500px;
      max-height: 90vh;
      overflow: auto;
      box-shadow: var(--shadow-lg);
    }

    .settings-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-lg);
      border-bottom: 1px solid var(--color-border);
    }

    .settings-header h2 {
      margin: 0;
      font-size: var(--font-size-lg);
      color: var(--color-text-primary);
    }

    .close-btn {
      background: transparent;
      border: none;
      color: var(--color-text-muted);
      font-size: 20px;
      cursor: pointer;
      padding: var(--spacing-xs);
    }

    .close-btn:hover {
      color: var(--color-text-primary);
    }

    .settings-content {
      padding: var(--spacing-lg);
    }

    .settings-info {
      color: var(--color-text-secondary);
      margin: 0 0 var(--spacing-lg) 0;
      font-size: var(--font-size-sm);
    }

    .form-group {
      margin-bottom: var(--spacing-lg);
    }

    .form-group label {
      display: block;
      margin-bottom: var(--spacing-xs);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
    }

    .required {
      color: var(--color-error);
      font-size: var(--font-size-xs);
      font-weight: normal;
    }

    .optional {
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
      font-weight: normal;
    }

    .form-input {
      width: 100%;
      padding: var(--spacing-sm) var(--spacing-md);
      background: var(--color-bg-input);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      color: var(--color-text-primary);
      font-size: var(--font-size-md);
      font-family: monospace;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--color-accent);
    }

    .input-error {
      border-color: var(--color-error);
    }

    .form-hint {
      margin: var(--spacing-xs) 0 0;
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
    }

    .form-hint a {
      color: var(--color-accent);
    }

    .error-message {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid var(--color-error);
      border-radius: var(--radius-md);
      padding: var(--spacing-sm) var(--spacing-md);
      color: var(--color-error);
      font-size: var(--font-size-sm);
      margin-bottom: var(--spacing-md);
    }

    .success-message {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid var(--color-success);
      border-radius: var(--radius-md);
      padding: var(--spacing-sm) var(--spacing-md);
      color: var(--color-success);
      font-size: var(--font-size-sm);
      margin-bottom: var(--spacing-md);
    }

    .settings-footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacing-sm);
      padding: var(--spacing-lg);
      border-top: 1px solid var(--color-border);
    }

    .btn {
      padding: var(--spacing-sm) var(--spacing-lg);
      border-radius: var(--radius-md);
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .btn-ghost {
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
    }

    .btn-ghost:hover {
      border-color: var(--color-text-secondary);
      color: var(--color-text-primary);
    }

    .btn-primary {
      background: var(--color-accent);
      border: none;
      color: white;
    }

    .btn-primary:hover {
      background: var(--color-accent-hover);
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .language-selector {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--spacing-xs);
    }

    .language-option {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      padding: var(--spacing-xs) var(--spacing-sm);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-bg-secondary);
      color: var(--color-text-primary);
      cursor: pointer;
      transition: all var(--transition-fast);
      font-size: var(--font-size-sm);
    }

    .language-option:hover {
      border-color: var(--color-accent);
      background: var(--color-bg-card-hover);
    }

    .language-option.active {
      border-color: var(--color-accent);
      background: var(--color-accent);
      color: white;
    }

    .language-option .flag {
      font-size: 1.2em;
    }

    .language-option .lang-name {
      color: inherit;
    }
  `]
})
export class SettingsComponent {
  private http = inject(HttpClient);
  settingsService = inject(UserSettingsService);
  i18n = inject(I18nService);

  @Output() close = new EventEmitter<void>();

  geminiApiKey = '';
  twitterBearerToken = '';
  githubPat = '';
  saveSuccess = signal(false);
  validationError = signal<string | null>(null);
  isValidating = signal(false);

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.close.emit();
  }

  constructor() {
    // Load current values
    const settings = this.settingsService.settings();
    if (settings) {
      this.geminiApiKey = settings.geminiApiKey || '';
      this.twitterBearerToken = settings.twitterBearerToken || '';
      this.githubPat = settings.githubPat || '';
    }
  }

  setLanguage(locale: SupportedLocale): void {
    this.i18n.setLocale(locale);
  }

  async save(): Promise<void> {
    this.saveSuccess.set(false);
    this.validationError.set(null);

    // Check if anything changed
    const currentGeminiKey = this.settingsService.getGeminiApiKey() || '';
    const currentTwitterToken = this.settingsService.getTwitterBearerToken() || '';
    const currentGithubPat = this.settingsService.getGithubPat() || '';

    const geminiChanged = this.geminiApiKey !== currentGeminiKey;
    const twitterChanged = this.twitterBearerToken !== currentTwitterToken;
    const githubChanged = this.githubPat !== currentGithubPat;

    // If nothing changed, just close
    if (!geminiChanged && !twitterChanged && !githubChanged) {
      this.close.emit();
      return;
    }

    // Validate Gemini API key if changed
    if (geminiChanged && this.geminiApiKey) {
      this.isValidating.set(true);
      try {
        const result = await this.http.post<{ valid: boolean; error?: string }>(
          '/api/gemini/validate-key',
          { apiKey: this.geminiApiKey }
        ).toPromise();

        if (!result?.valid) {
          this.validationError.set(`Gemini: ${result?.error || this.i18n.t.settings.geminiInvalid}`);
          this.isValidating.set(false);
          return;
        }
      } catch (error: any) {
        this.validationError.set(`Gemini: ${error.message || this.i18n.t.settings.geminiValidationError}`);
        this.isValidating.set(false);
        return;
      }
    }

    // Validate Twitter bearer token if changed (optional, so only validate if provided)
    if (twitterChanged && this.twitterBearerToken) {
      this.isValidating.set(true);
      try {
        const result = await this.http.post<{ valid: boolean; error?: string }>(
          '/api/twitter/validate-token',
          { bearerToken: this.twitterBearerToken }
        ).toPromise();

        if (!result?.valid) {
          this.validationError.set(`Twitter: ${result?.error || this.i18n.t.settings.twitterInvalid}`);
          this.isValidating.set(false);
          return;
        }
      } catch (error: any) {
        this.validationError.set(`Twitter: ${error.message || this.i18n.t.settings.twitterValidationError}`);
        this.isValidating.set(false);
        return;
      }
    }

    this.isValidating.set(false);

    // All validations passed, save settings
    try {
      await this.settingsService.saveSettings({
        geminiApiKey: this.geminiApiKey,
        twitterBearerToken: this.twitterBearerToken,
        githubPat: this.githubPat
      });
      this.saveSuccess.set(true);

      // Auto-close after 1.5 seconds
      setTimeout(() => this.close.emit(), 1500);
    } catch (error: any) {
      this.validationError.set(error.message || 'Error saving settings');
    }
  }
}
