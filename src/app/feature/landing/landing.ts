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
      key: 'dashboard',
      icon: 'dashboard',
      groupKey: 'landing.features.groups.staff',
      titleKey: 'landing.features.dashboard.title',
      descKey:  'landing.features.dashboard.description'
    },
    {
      key: 'caseManagement',
      icon: 'work',
      groupKey: 'landing.features.groups.staff',
      titleKey: 'landing.features.caseManagement.title',
      descKey:  'landing.features.caseManagement.description'
    },
    {
      key: 'callCenter',
      icon: 'call',
      groupKey: 'landing.features.groups.staff',
      titleKey: 'landing.features.callCenter.title',
      descKey:  'landing.features.callCenter.description'
    },
    {
      key: 'workflow',
      icon: 'rule_settings',
      groupKey: 'landing.features.groups.staff',
      titleKey: 'landing.features.workflow.title',
      descKey:  'landing.features.workflow.description'
    },
    {
      key: 'reports',
      icon: 'bar_chart',
      groupKey: 'landing.features.groups.supervisor',
      titleKey: 'landing.features.reports.title',
      descKey:  'landing.features.reports.description'
    },
    {
      key: 'referenceData',
      icon: 'settings',
      groupKey: 'landing.features.groups.supervisor',
      titleKey: 'landing.features.referenceData.title',
      descKey:  'landing.features.referenceData.description'
    },
    {
      key: 'userManagement',
      icon: 'group',
      groupKey: 'landing.features.groups.admin',
      titleKey: 'landing.features.userManagement.title',
      descKey:  'landing.features.userManagement.description'
    },
    {
      key: 'security',
      icon: 'security',
      groupKey: 'landing.features.groups.platform',
      titleKey: 'landing.features.security.title',
      descKey:  'landing.features.security.description'
    }
  ]);

  toggleLanguage(): void {
    this.languageService.toggleLanguage();
  }
}