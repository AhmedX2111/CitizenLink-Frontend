/*
 * AuthGuard spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - allows navigation when a valid (unexpired) token is present (no refresh call)
 *   - allows navigation after a successful silent refresh
 *   - redirects to /login with returnUrl when the refresh fails
 *   - an expired token falls through to the refresh path instead of being admitted
 *
 * SKIPPED (with reason):
 *   - Concurrent guard invocations: the guard is stateless per call and defers to
 *     AuthService.refreshSession(); the interceptor spec covers refresh coalescing.
 */

import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthGuard } from './auth.guard';
import { AuthTokenService } from './auth-token.service';
import { AuthService } from './auth.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let tokenService: { getToken: ReturnType<typeof vi.fn>; isAuthenticated: ReturnType<typeof vi.fn> };
  let authService: { refreshSession: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/app/cases/123' } as RouterStateSnapshot;

  beforeEach(() => {
    tokenService = { getToken: vi.fn().mockReturnValue(null), isAuthenticated: vi.fn().mockReturnValue(false) };
    authService = { refreshSession: vi.fn() };
    router = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        { provide: AuthTokenService, useValue: tokenService },
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router }
      ]
    });

    guard = TestBed.inject(AuthGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('allows navigation when a valid token is present and does not refresh', () => {
    tokenService.getToken.mockReturnValue('jwt');
    tokenService.isAuthenticated.mockReturnValue(true);

    let result: boolean | undefined;
    guard.canActivate(route, state).subscribe(v => (result = v));

    expect(result).toBe(true);
    expect(authService.refreshSession).not.toHaveBeenCalled();
  });

  it('falls through to refresh when a token exists but has expired', () => {
    tokenService.getToken.mockReturnValue('expired-jwt');
    tokenService.isAuthenticated.mockReturnValue(false);
    authService.refreshSession.mockReturnValue(of({ token: 'new-jwt' } as never));

    let result: boolean | undefined;
    guard.canActivate(route, state).subscribe(v => (result = v));

    expect(authService.refreshSession).toHaveBeenCalled();
    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects to /login with returnUrl and blocks navigation when the expired token cannot be refreshed', () => {
    tokenService.getToken.mockReturnValue('expired-jwt');
    tokenService.isAuthenticated.mockReturnValue(false);
    authService.refreshSession.mockReturnValue(throwError(() => ({ status: 401 })));

    let result: boolean | undefined;
    guard.canActivate(route, state).subscribe(v => (result = v));

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/app/cases/123' }
    });
  });

  it('allows navigation after a successful silent refresh', () => {
    authService.refreshSession.mockReturnValue(of({ token: 'new-jwt' } as never));

    let result: boolean | undefined;
    guard.canActivate(route, state).subscribe(v => (result = v));

    expect(authService.refreshSession).toHaveBeenCalled();
    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects to /login with returnUrl and blocks navigation when refresh fails', () => {
    authService.refreshSession.mockReturnValue(throwError(() => ({ status: 401 })));

    let result: boolean | undefined;
    guard.canActivate(route, state).subscribe(v => (result = v));

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/app/cases/123' }
    });
  });
});
