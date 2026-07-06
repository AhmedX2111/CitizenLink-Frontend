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
      icon: 'timer',
      titleKey: 'landing.features.sla.title',
      descKey:  'landing.features.sla.description'
    },
    {
      key: 'channels',
      icon: 'dynamic_feed',
      titleKey: 'landing.features.channels.title',
      descKey:  'landing.features.channels.description'
    },
    {
      key: 'workflow',
      icon: 'rule_settings',
      titleKey: 'landing.features.workflow.title',
      descKey:  'landing.features.workflow.description'
    },
    {
      key: 'reports',
      icon: 'analytics',
      titleKey: 'landing.features.reports.title',
      descKey:  'landing.features.reports.description'
    }
  ]);

  toggleLanguage(): void {
    this.languageService.toggleLanguage();
  }
}