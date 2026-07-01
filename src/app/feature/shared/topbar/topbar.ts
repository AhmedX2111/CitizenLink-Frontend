import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  templateUrl: './topbar.html'
})
export class TopbarComponent {
  private transloco = inject(TranslocoService);

  isArabic = computed(() => this.transloco.getActiveLang() === 'ar');

  toggleLanguage(): void {
    const current = this.transloco.getActiveLang();
    const next = current === 'en' ? 'ar' : 'en';
    this.transloco.setActiveLang(next);
    localStorage.setItem('preferredLanguage', next);
    this.applyDirection(next);
  }

  private applyDirection(lang: string): void {
    const html = document.documentElement;
    if (lang === 'ar') {
      html.setAttribute('dir', 'rtl');
      html.setAttribute('lang', 'ar');
    } else {
      html.removeAttribute('dir');
      html.setAttribute('lang', 'en');
    }
  }
}