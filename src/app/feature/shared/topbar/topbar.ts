import { Component, inject } from '@angular/core';
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

  isArabic(): boolean {
    return this.transloco.getActiveLang() === 'ar';
  }

  today(): string {
    return new Date().toLocaleDateString(this.isArabic() ? 'ar-EG' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  toggleLanguage(): void {
    const next = this.isArabic() ? 'en' : 'ar';
    this.transloco.setActiveLang(next);
    document.documentElement.setAttribute('dir', next === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', next);
    localStorage.setItem('preferredLanguage', next);
  }
}