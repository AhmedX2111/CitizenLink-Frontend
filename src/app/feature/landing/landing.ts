import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoModule],
  templateUrl: './landing.html',
  styleUrl: './landing.css'
})
export class LandingComponent {

  private languageService = inject(LanguageService);
  currentLang             = this.languageService.currentLang;

  features = signal([
    {
      key: 'sla',
      icon: 'M12 8v4l3 3M12 2a10 10 0 1010 10 10 10 0 00-10-10z',
      titleKey: 'landing.features.sla.title',
      descKey:  'landing.features.sla.description'
    },
    {
      key: 'channels',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      titleKey: 'landing.features.channels.title',
      descKey:  'landing.features.channels.description'
    },
    {
      key: 'workflow',
      icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
      titleKey: 'landing.features.workflow.title',
      descKey:  'landing.features.workflow.description'
    },
    {
      key: 'reports',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      titleKey: 'landing.features.reports.title',
      descKey:  'landing.features.reports.description'
    }
  ]);

  toggleLanguage(): void {
    this.languageService.toggleLanguage();
  }
}