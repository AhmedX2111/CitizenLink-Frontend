/*
 * Login component spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - Form validation: empty / short password blocks submission
 *   - Successful login: navigates to /dashboard, or to a safe returnUrl
 *   - Unauthorized (401): invalid credentials -> invalidCredentials message,
 *     password cleared, no navigation
 *   - Account locked / disabled / inactive (401 body) -> accountInactive message
 *   - Forbidden (403): inactive account -> accountInactive, stays on login page
 *   - Network error (status 0) -> connectionFailed message
 *   - Server errors (5xx), 4xx and unknown statuses map to the right i18n key
 *   - Already-authenticated visits redirect away from the login page based on
 *     the resolved authState session (not the in-memory token)
 *
 * SKIPPED (with reason):
 *   - Refresh token flows: covered by auth.service.spec / auth.interceptor.spec /
 *     auth.guard.spec (success, failure -> /login, concurrent coalescing).
 */

import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';

import { Login } from './login.component';
import { AuthService } from '../auth.service';
import { AuthResponse } from '../models/auth.models';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let component: Login;

  let authService: { login: ReturnType<typeof vi.fn>; authState$: BehaviorSubject<AuthResponse | null> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };
  let route: { snapshot: { queryParams: { returnUrl?: string | null } } };

  beforeEach(async () => {
    authService = { login: vi.fn(), authState$: new BehaviorSubject<AuthResponse | null>(null) };
    router = { navigateByUrl: vi.fn() };
    route = { snapshot: { queryParams: {} } };

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: route },
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

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const errorText = (): string | null => {
    const el = fixture.nativeElement.querySelector('span.text-red-700') as HTMLElement | null;
    return el?.textContent?.trim() ?? null;
  };

  const submitButtonText = (): string =>
    (fixture.nativeElement.querySelector('button[type="submit"]') as HTMLElement).textContent?.trim() ?? '';

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('form validation', () => {
    it('blocks submission when the form is empty', () => {
      component.onSubmit();

      expect(authService.login).not.toHaveBeenCalled();
      expect(component.username?.touched).toBe(true);
      expect(component.password?.touched).toBe(true);
    });

    it('blocks submission when the password is too short', () => {
      component.loginForm.patchValue({ username: 'admin', password: '123' });
      component.onSubmit();

      expect(component.password?.invalid).toBe(true);
      expect(authService.login).not.toHaveBeenCalled();
    });
  });

  describe('successful login', () => {
    it('navigates to /dashboard by default', () => {
      authService.login.mockReturnValue(
        of({ token: 'jwt', id: 'u-1', username: 'admin', displayName: 'Admin', email: 'a@b.c', role: 'ADMIN' })
      );
      component.loginForm.patchValue({ username: 'admin', password: 'password123' });

      component.onSubmit();

      expect(authService.login).toHaveBeenCalledWith({
        username: 'admin',
        password: 'password123',
        rememberMe: false
      });
      expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });

    it('navigates to a safe returnUrl when one was provided', () => {
      route.snapshot.queryParams.returnUrl = '/app/cases/123';
      authService.login.mockReturnValue(of({} as never));
      component.loginForm.patchValue({ username: 'admin', password: 'password123' });

      component.ngOnInit();
      component.onSubmit();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/app/cases/123');
    });

    it('ignores an unsafe external returnUrl', () => {
      route.snapshot.queryParams.returnUrl = 'https://evil.example.com';
      authService.login.mockReturnValue(of({} as never));
      component.loginForm.patchValue({ username: 'admin', password: 'password123' });

      component.ngOnInit();
      component.onSubmit();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('login failures', () => {
    it('shows invalidCredentials for a 401, clears the password and stays on the page', () => {
      authService.login.mockReturnValue(
        throwError(() => ({ status: 401, error: { message: 'Invalid username or password' } }))
      );
      component.loginForm.patchValue({ username: 'admin', password: 'wrongpass' });

      component.onSubmit();
      fixture.detectChanges();

      expect(errorText()).toBe('login.errors.invalidCredentials');
      expect(component.password?.value).toBe('');
      expect(submitButtonText()).toBe('login.signIn');
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('treats a plain string 401 body as invalidCredentials', () => {
      authService.login.mockReturnValue(throwError(() => ({ status: 401, error: 'Bad credentials' })));
      component.loginForm.patchValue({ username: 'admin', password: 'wrongpass' });

      component.onSubmit();
      fixture.detectChanges();

      expect(errorText()).toBe('login.errors.invalidCredentials');
    });

    it('shows accountInactive when the account is locked', () => {
      authService.login.mockReturnValue(
        throwError(() => ({
          status: 401,
          error: { message: 'Account locked after multiple failed attempts' }
        }))
      );
      component.loginForm.patchValue({ username: 'admin', password: 'password123' });

      component.onSubmit();
      fixture.detectChanges();

      expect(errorText()).toBe('login.errors.accountInactive');
    });

    it('shows accountInactive when the account is disabled', () => {
      authService.login.mockReturnValue(
        throwError(() => ({ status: 401, error: { message: 'User is disabled' } }))
      );
      component.loginForm.patchValue({ username: 'admin', password: 'password123' });

      component.onSubmit();
      fixture.detectChanges();

      expect(errorText()).toBe('login.errors.accountInactive');
    });

    it('shows accountInactive when the account is deactivated', () => {
      authService.login.mockReturnValue(
        throwError(() => ({ status: 401, error: { message: 'Account deactivated' } }))
      );
      component.loginForm.patchValue({ username: 'admin', password: 'password123' });

      component.onSubmit();
      fixture.detectChanges();

      expect(errorText()).toBe('login.errors.accountInactive');
    });

    it('shows connectionFailed for a network error', () => {
      authService.login.mockReturnValue(throwError(() => ({ status: 0, statusText: 'Unknown Error' })));
      component.loginForm.patchValue({ username: 'admin', password: 'password123' });

      component.onSubmit();
      fixture.detectChanges();

      expect(errorText()).toBe('login.errors.connectionFailed');
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('shows serverError for a 500', () => {
      authService.login.mockReturnValue(throwError(() => ({ status: 500 })));
      component.loginForm.patchValue({ username: 'admin', password: 'password123' });

      component.onSubmit();
      fixture.detectChanges();

      expect(errorText()).toBe('login.errors.serverError');
    });

    it('shows badRequest for a 400', () => {
      authService.login.mockReturnValue(throwError(() => ({ status: 400 })));
      component.loginForm.patchValue({ username: 'admin', password: 'password123' });

      component.onSubmit();
      fixture.detectChanges();

      expect(errorText()).toBe('login.errors.badRequest');
    });

    it('shows endpointNotFound for a 404', () => {
      authService.login.mockReturnValue(throwError(() => ({ status: 404 })));
      component.loginForm.patchValue({ username: 'admin', password: 'password123' });

      component.onSubmit();
      fixture.detectChanges();

      expect(errorText()).toBe('login.errors.endpointNotFound');
    });

    it('shows an unknown message with the status for unhandled codes', () => {
      authService.login.mockReturnValue(throwError(() => ({ status: 429 })));
      component.loginForm.patchValue({ username: 'admin', password: 'password123' });

      component.onSubmit();
      fixture.detectChanges();

      expect(errorText()).toBe('login.errors.unknown: 429');
    });
  });

  describe('inactive user handling', () => {
    it('rejects the login and stays on the page for a 403', () => {
      authService.login.mockReturnValue(throwError(() => ({ status: 403 })));
      component.loginForm.patchValue({ username: 'inactive', password: 'password123' });

      component.onSubmit();
      fixture.detectChanges();

      expect(errorText()).toBe('login.errors.accountInactive');
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('never navigates away after an inactive-account rejection', () => {
      authService.login.mockReturnValue(
        throwError(() => ({ status: 401, error: { message: 'Account is locked' } }))
      );
      component.loginForm.patchValue({ username: 'inactive', password: 'password123' });

      component.onSubmit();
      fixture.detectChanges();

      expect(errorText()).toBe('login.errors.accountInactive');
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });
  });

  describe('already authenticated', () => {
    it('redirects to /dashboard when the session resolves with no returnUrl', () => {
      authService.authState$.next({
        token: 'jwt', id: 'u-1', username: 'admin', displayName: 'Admin',
        email: 'a@b.c', role: 'ADMIN'
      });

      component.ngOnInit();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });

    it('redirects to a safe returnUrl when the session resolves', () => {
      route.snapshot.queryParams.returnUrl = '/app/cases/456';
      authService.authState$.next({
        token: 'jwt', id: 'u-1', username: 'admin', displayName: 'Admin',
        email: 'a@b.c', role: 'ADMIN'
      });

      component.ngOnInit();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/app/cases/456');
    });

    it('does not redirect when no session is resolved', () => {
      component.ngOnInit();

      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });
  });
});
