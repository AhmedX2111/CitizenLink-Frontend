/*
 * ForbiddenComponent spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - renders the 403 page title and message from i18n
 *   - provides a link back to the dashboard
 *
 * SKIPPED (with reason):
 *   - Navigation behaviour from the button: plain routerLink anchor,
 *     route activation exercised by RoleGuard spec instead.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';

import { ForbiddenComponent } from './forbidden.component';

describe('ForbiddenComponent', () => {
  let fixture: ComponentFixture<ForbiddenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForbiddenComponent],
      providers: [
        provideRouter([]),
        {
          provide: TranslocoService,
          useValue: {
            translate: (key: string) => key,
            setActiveLang: () => undefined,
            getActiveLang: () => 'en',
            config: { reRenderOnLangChange: false },
            langChanges$: new BehaviorSubject('en'),
            _loadDependencies: () => of(undefined)
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ForbiddenComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the access denied title and message', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('forbidden.title');
    expect(text).toContain('forbidden.message');
  });

  it('renders a link back to the dashboard', () => {
    const link = fixture.nativeElement.querySelector('a[routerlink="/dashboard"]') as HTMLElement | null;
    expect(link).toBeTruthy();
    expect((link?.textContent ?? '').trim()).toContain('forbidden.backToDashboard');
  });
});
