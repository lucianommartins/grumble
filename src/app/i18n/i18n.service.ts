import { Injectable, signal, effect } from '@angular/core';
import { en, LocaleStrings } from './en';
import { ptBR } from './pt-br';
import { ptPT } from './pt-pt';
import { es } from './es';
import { fr } from './fr';
import { zh } from './zh';
import { ja } from './ja';
import { de } from './de';

export type SupportedLocale = 'en' | 'pt-br' | 'pt-pt' | 'es' | 'fr' | 'zh' | 'ja' | 'de';

export interface LocaleOption {
  code: SupportedLocale;
  name: string;
  flag: string;
  languageCode: string; // For AI prompts
}

export const LOCALE_OPTIONS: LocaleOption[] = [
  { code: 'pt-br', name: 'Português', flag: '🇧🇷', languageCode: 'Brazilian Portuguese' },
  { code: 'pt-pt', name: 'Português', flag: '🇵🇹', languageCode: 'European Portuguese' },
  { code: 'es', name: 'Español', flag: '🇪🇸', languageCode: 'Spanish' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', languageCode: 'French' },
  { code: 'zh', name: '中文', flag: '🇨🇳', languageCode: 'Simplified Chinese' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', languageCode: 'Japanese' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', languageCode: 'German' },
  { code: 'en', name: 'English', flag: '🇬🇧', languageCode: 'English' },
];

const LOCALE_STORAGE_KEY = 'grumble_locale';

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private currentLocale = signal<SupportedLocale>(this.getInitialLocale());

  private locales: Record<SupportedLocale, LocaleStrings> = {
    en,
    'pt-br': ptBR,
    'pt-pt': ptPT,
    es,
    fr,
    zh,
    ja,
    de
  };

  constructor() {
    // Persist locale changes to localStorage
    effect(() => {
      const locale = this.currentLocale();
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    });
  }

  private getInitialLocale(): SupportedLocale {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY) as SupportedLocale | null;
    if (stored && this.isValidLocale(stored)) {
      return stored;
    }
    // Default to English for first-time users
    return 'en';
  }

  private isValidLocale(locale: string): locale is SupportedLocale {
    return ['en', 'pt-br', 'pt-pt', 'es', 'fr', 'zh', 'ja', 'de'].includes(locale);
  }

  /**
   * Get the current locale strings
   */
  get t(): LocaleStrings {
    return this.locales[this.currentLocale()];
  }

  /**
   * Get locale options for the language selector
   */
  get localeOptions(): LocaleOption[] {
    return LOCALE_OPTIONS;
  }

  /**
   * Get a nested translation by path (e.g., 'settings.title')
   */
  translate(path: string): string {
    const keys = path.split('.');
    let result: any = this.t;

    for (const key of keys) {
      result = result?.[key];
      if (result === undefined) {
        console.warn(`[i18n] Missing translation: ${path}`);
        return path;
      }
    }

    return result as string;
  }

  /**
   * Change the current locale
   */
  setLocale(locale: SupportedLocale): void {
    this.currentLocale.set(locale);
  }

  /**
   * Get the current locale code
   */
  getLocale(): SupportedLocale {
    return this.currentLocale();
  }

  /**
   * Get the language code for AI prompts (e.g., "Brazilian Portuguese")
   */
  getLanguageForPrompt(): string {
    const option = LOCALE_OPTIONS.find(o => o.code === this.currentLocale());
    return option?.languageCode || 'English';
  }

  /**
   * Get the current locale option
   */
  getCurrentLocaleOption(): LocaleOption {
    return LOCALE_OPTIONS.find(o => o.code === this.currentLocale()) || LOCALE_OPTIONS[0];
  }
}
