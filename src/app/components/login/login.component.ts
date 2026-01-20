import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { I18nService } from '../../i18n';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <img src="/logo.png" alt="Grumble" class="login-logo" />
          <h1 class="login-title">{{ i18n.t.login.appName }}</h1>
          <p class="login-subtitle">{{ i18n.t.login.tagline }}</p>
        </div>

        @if (authService.isLoading()) {
        <div class="login-loading">
          <div class="spinner"></div>
          <p>{{ i18n.t.common.loading }}</p>
        </div>
        } @else {
        
        @if (authService.authError()) {
        <div class="login-error">
          <span class="error-icon">⚠️</span>
          <p>{{ authService.authError() }}</p>
        </div>
        }
        
        <button class="google-btn" (click)="signIn()">
          <svg class="google-icon" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {{ i18n.t.auth.signIn }}
        </button>
        }

        <div class="feature-list">
          <div class="feature-item">
            <span class="feature-icon">📡</span>
            <div>
              <strong>{{ i18n.t.login.feature1Title }}</strong>
              <p>{{ i18n.t.login.feature1Desc }}</p>
            </div>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🤖</span>
            <div>
              <strong>{{ i18n.t.login.feature2Title }}</strong>
              <p>{{ i18n.t.login.feature2Desc }}</p>
            </div>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🎨</span>
            <div>
              <strong>{{ i18n.t.login.feature3Title }}</strong>
              <p>{{ i18n.t.login.feature3Desc }}</p>
            </div>
          </div>
        </div>

        <div class="language-selector-section">
          <div class="language-selector">
            @for (option of i18n.localeOptions; track option.code) {
            <button 
              class="language-option" 
              [class.active]="i18n.getLocale() === option.code"
              (click)="setLanguage(option.code)"
            >
              <span class="flag">{{ option.flag }}</span>
            </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-bg-primary);
      padding: var(--spacing-lg);
    }

    .login-card {
      background: var(--color-bg-card);
      border-radius: var(--radius-lg);
      padding: var(--spacing-2xl);
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--color-border);
    }

    .login-header {
      margin-bottom: var(--spacing-xl);
    }

    .login-title {
      font-size: 2.5rem;
      font-weight: var(--font-weight-bold);
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin: 0 0 var(--spacing-sm) 0;
    }

    .login-logo {
      width: 80px;
      height: 80px;
      border-radius: var(--radius-lg);
      margin-bottom: var(--spacing-md);
    }

    .login-subtitle {
      color: var(--color-text-secondary);
      margin: 0;
    }

    .login-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-lg);
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--color-border);
      border-top-color: var(--color-accent);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .login-error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid var(--color-error);
      border-radius: var(--radius-md);
      padding: var(--spacing-md);
      margin-bottom: var(--spacing-md);
      color: var(--color-error);
    }

    .login-error p {
      margin: var(--spacing-xs) 0 0 0;
      font-size: var(--font-size-sm);
    }

    .error-icon {
      font-size: 24px;
    }

    .google-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-sm);
      width: 100%;
      padding: var(--spacing-md) var(--spacing-lg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-bg-secondary);
      color: var(--color-text-primary);
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .google-btn:hover {
      background: var(--color-bg-card-hover);
      border-color: var(--color-accent);
      box-shadow: var(--shadow-glow);
    }

    .google-icon {
      width: 20px;
      height: 20px;
    }

    .login-footer {
      margin-top: var(--spacing-lg);
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
    }

    .feature-list {
      margin-top: var(--spacing-xl);
      text-align: left;
    }

    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-md);
    }

    .feature-icon {
      font-size: 1.5rem;
      flex-shrink: 0;
    }

    .feature-item strong {
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
    }

    .feature-item p {
      margin: 2px 0 0 0;
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
    }

    .language-selector-section {
      margin-top: var(--spacing-lg);
      padding-top: var(--spacing-md);
      border-top: 1px solid var(--color-border);
    }

    .language-selector {
      display: flex;
      justify-content: center;
      gap: var(--spacing-xs);
    }

    .language-option {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-xs);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-bg-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);
      font-size: 1.3rem;
      width: 40px;
      height: 40px;
    }

    .language-option:hover {
      border-color: var(--color-accent);
      background: var(--color-bg-card-hover);
      transform: scale(1.1);
    }

    .language-option.active {
      border-color: var(--color-accent);
      background: var(--color-accent);
      box-shadow: var(--shadow-glow);
    }
  `]
})
export class LoginComponent {
  authService = inject(AuthService);
  private themeService = inject(ThemeService); // Ensures theme is applied
  i18n = inject(I18nService);
  error = signal<string | null>(null);

  setLanguage(locale: string): void {
    this.i18n.setLocale(locale as any);
  }

  async signIn(): Promise<void> {
    this.error.set(null);
    try {
      await this.authService.signInWithGoogle();
    } catch (err: any) {
      this.error.set(err.message || this.i18n.t.errors.unknownError);
    }
  }
}


