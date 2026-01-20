import { Injectable, inject, signal, effect } from '@angular/core';
import { AuthService } from './auth.service';

export type Theme = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY_PREFIX = 'grumble-theme';
  private authService = inject(AuthService);

  currentTheme = signal<Theme>('dark'); // Default

  constructor() {
    // React to user changes
    effect(() => {
      const user = this.authService.currentUser();
      const theme = this.getStoredTheme(user?.uid);
      this.currentTheme.set(theme);
      this.applyTheme(theme);
    });
  }

  private getStorageKey(userId?: string): string {
    return userId ? `${this.STORAGE_KEY_PREFIX}-${userId}` : this.STORAGE_KEY_PREFIX;
  }

  private getStoredTheme(userId?: string): Theme {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(this.getStorageKey(userId));
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    }
    return 'dark'; // Default theme
  }

  toggle(): void {
    const newTheme = this.currentTheme() === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  setTheme(theme: Theme): void {
    this.currentTheme.set(theme);
    this.applyTheme(theme);

    const userId = this.authService.currentUser()?.uid;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.getStorageKey(userId), theme);
    }
  }

  private applyTheme(theme: Theme): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  isDark(): boolean {
    return this.currentTheme() === 'dark';
  }
}

