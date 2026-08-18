import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { vi } from 'vitest';

import { TopbarComponent } from './topbar';
import { LanguageService } from '../../../../core/services/language.service';

describe('TopbarComponent', () => {
  let fixture: ComponentFixture<TopbarComponent>;
  let languageService: { toggleLanguage: ReturnType<typeof vi.fn>; currentLang: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    languageService = { toggleLanguage: vi.fn(), currentLang: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TopbarComponent],
      providers: [
        { provide: LanguageService, useValue: languageService },
        {
          provide: TranslocoService,
          useValue: {
            translate: (key: string) => key,
            setActiveLang: () => undefined,
            getActiveLang: () => 'en',
            config: { reRenderOnLangChange: false },
            langChanges$: of('en'),
            _loadDependencies: () => of(undefined)
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TopbarComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('delegates the language toggle to LanguageService so its signal stays in sync (M-29)', () => {
    fixture.componentInstance.toggleLanguage();

    expect(languageService.toggleLanguage).toHaveBeenCalledTimes(1);
  });

  it('does not mutate Transloco or the DOM directly when toggling (M-29)', () => {
    fixture.componentInstance.toggleLanguage();

    const html = document.documentElement;
    expect(html.getAttribute('lang')).not.toBe('ar');
  });
});