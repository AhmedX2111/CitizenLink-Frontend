/*
 * Sidebar spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - Dashboard and Cases links are always visible regardless of role
 *   - Reports + Reference Data links visible only for ADMIN/SUPERVISOR
 *   - Users link visible only for ADMIN
 *   - Role change (authState$ emission) re-renders the nav immediately
 *   - Logout button triggers authService.logout
 *   - "New Case" button navigates to /cases with tab=create (M-27)
 *
 * SKIPPED (with reason):
 *   - Full router integration (routerLinkActive): rendered via RouterModule in jsdom,
 *     exercised only as static anchors here.
 */

import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';

import { SidebarComponent } from './sidebar';
import { AuthService } from '../../../auth/auth.service';
import { AuthResponse } from '../../../auth/models/auth.models';

function user(role: string): AuthResponse {
  return {
    token: 'jwt',
    id: 'u-1',
    username: 'tester',
    displayName: 'Tester',
    email: 'tester@example.com',
    role
  } as AuthResponse;
}

describe('SidebarComponent', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  let authState$: BehaviorSubject<AuthResponse | null>;
  let authService: { authState$: BehaviorSubject<AuthResponse | null>; logout: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authState$ = new BehaviorSubject<AuthResponse | null>(null);
    authService = { authState$: authState$ as never, logout: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        {
          provide: TranslocoService,
          useValue: {
            translate: (key: string) => key,
            setActiveLang: () => undefined,
            getActiveLang: () => 'en',
            config: { reRenderOnLangChange: false },
            langChanges$: new BehaviorSubject('en'),
            _loadDependencies: () => of(undefined),
            _translate: (key: string) => key
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
  });

  const anchorLabels = (): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll('nav a'))
      .map((a) => (a as HTMLElement).textContent?.trim() ?? '');

  const hasLabel = (label: string): boolean => anchorLabels().some((t) => t.includes(label));

  const hasRoute = (path: string): boolean =>
    Array.from(fixture.nativeElement.querySelectorAll('nav a')).some(
      (a) => (a as HTMLElement).getAttribute('href') === path
    );

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows Dashboard and Cases links for a logged-out user', () => {
    authState$.next(null);
    fixture.detectChanges();

    expect(hasLabel('nav.dashboard')).toBe(true);
    expect(hasLabel('cases.title')).toBe(true);
  });

  it('does not show role-restricted links for a regular user', () => {
    authState$.next(user('HANDLER'));
    fixture.detectChanges();

    expect(hasLabel('nav.dashboard')).toBe(true);
    expect(hasLabel('nav.reports')).toBe(false);
    expect(hasLabel('nav.referenceData')).toBe(false);
    expect(hasLabel('nav.users')).toBe(false);
  });

  it('shows Reports and Reference Data for a SUPERVISOR but not Users', () => {
    authState$.next(user('SUPERVISOR'));
    fixture.detectChanges();

    expect(hasLabel('nav.reports')).toBe(true);
    expect(hasLabel('nav.referenceData')).toBe(true);
    expect(hasLabel('nav.users')).toBe(false);
  });

  it('shows Reports, Reference Data and Users for an ADMIN', () => {
    authState$.next(user('ADMIN'));
    fixture.detectChanges();

    expect(hasLabel('nav.reports')).toBe(true);
    expect(hasLabel('nav.referenceData')).toBe(true);
    expect(hasLabel('nav.users')).toBe(true);
  });

  it('reflects a role change immediately by hiding admin links', () => {
    authState$.next(user('ADMIN'));
    fixture.detectChanges();
    expect(hasLabel('nav.users')).toBe(true);

    authState$.next(user('HANDLER'));
    fixture.detectChanges();

    expect(hasLabel('nav.users')).toBe(false);
    expect(hasLabel('nav.reports')).toBe(false);
    expect(hasLabel('nav.referenceData')).toBe(false);
  });

  it('logs the user out from the sign-out button', () => {
    authState$.next(user('ADMIN'));
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button[title="sidebar.signOut"]') as HTMLElement;
    button.click();

    expect(authService.logout).toHaveBeenCalled();
  });

  it('navigates to /cases with tab=create when "New Case" is clicked (M-27)', () => {
    authState$.next(user('ADMIN'));
    fixture.detectChanges();

    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture.componentInstance.createNewCase();

    expect(navigateSpy).toHaveBeenCalledWith(['/cases'], { queryParams: { tab: 'create' } });
  });

  it('links to the expected routes', () => {
    authState$.next(user('ADMIN'));
    fixture.detectChanges();

    expect(hasRoute('/dashboard')).toBe(true);
    expect(hasRoute('/cases')).toBe(true);
    expect(hasRoute('/reports')).toBe(true);
    expect(hasRoute('/admin/reference-data')).toBe(true);
    expect(hasRoute('/app/users')).toBe(true);
  });
});
