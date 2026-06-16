import { Injectable, signal, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { TranslocoService } from '@jsverse/transloco';

@Injectable({ providedIn: 'root' })
export class LanguageService {

  private document      = inject(DOCUMENT);
  private translocoService = inject(TranslocoService);

  readonly languages    = ['en', 'ar'] as const;
  currentLang           = signal<string>(
    localStorage.getItem('preferredLanguage') ?? 'en'
  );

  constructor() {
    // Apply the persisted language on startup
    this.applyLanguage(this.currentLang());

    // Keep Transloco and DOM in sync whenever signal changes
    effect(() => {
      this.applyLanguage(this.currentLang());
    });
  }

  toggleLanguage(): void {
    const next = this.currentLang() === 'en' ? 'ar' : 'en';
    this.setLanguage(next);
  }

  setLanguage(lang: string): void {
    if (this.languages.includes(lang as 'en' | 'ar')) {
      this.currentLang.set(lang);
      localStorage.setItem('preferredLanguage', lang);
    }
  }

  private applyLanguage(lang: string): void {
    // 1. Tell Transloco to switch active language
    this.translocoService.setActiveLang(lang);

    // 2. Update <html> dir and lang attributes
    const html = this.document.documentElement;
    if (lang === 'ar') {
      html.setAttribute('dir', 'rtl');
      html.setAttribute('lang', 'ar');
    } else {
      html.removeAttribute('dir');
      html.setAttribute('lang', 'en');
    }
  }
}