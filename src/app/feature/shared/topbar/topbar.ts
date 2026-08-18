import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LanguageService } from '../../../../core/services/language.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  templateUrl: './topbar.html'
})
export class TopbarComponent {
  private transloco = inject(TranslocoService);
  private languageService = inject(LanguageService);

  isArabic(): boolean {
    return this.transloco.getActiveLang() === 'ar';
  }

  today(): string {
    return new Date().toLocaleDateString(this.isArabic() ? 'ar-EG' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  toggleLanguage(): void {
    this.languageService.toggleLanguage();
  }
}