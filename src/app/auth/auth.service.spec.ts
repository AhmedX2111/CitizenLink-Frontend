/*
 * AuthService spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - constructor restores session via refreshSession() on startup
 *   - refreshSession coalesces concurrent calls into a single request (prevents
 *     the backend's refresh-token rotation from rejecting the second call)
 *   - a new refresh is allowed after the previous one completes
 *   - login: POSTs credentials with withCredentials, saves auth data, emits authState
 *   - refreshSession with full user payload: restores token + identity (saveAuthData), emits authState
 *   - refreshSession with token-only payload: falls back to saveToken, still emits authState
 *   - refreshSession error: propagates error (tryRestoreSession catches it)
 *   - logout: POSTs logout, clears auth data, emits null, navigates to '/'
 *
 * SKIPPED (with reason):
 *   - refreshSession emitting authState only when displayName present: replaced by new
 *     behavior that always emits authState on a successful refresh (token present).
 */

import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { environment } from '../../environments/environment';

const AUTH_URL = `${environment.apiUrl}/api/v1/auth`;

const fullUser = {
  token: 'refresh-token-1',
  id: 'u-1',
  username: 'admin',
  displayName: 'Admin User',
  email: 'admin@example.com',
  role: 'ADMIN' as const
};

const tokenOnly = { token: 'refresh-token-2' };

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let tokenService: AuthTokenService;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    router = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router }
      ]
    });

    tokenService = TestBed.inject(AuthTokenService);
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    httpMock.expectOne({ method: 'POST', url: `${AUTH_URL}/refresh` }).flush(tokenOnly);
    expect(service).toBeTruthy();
  });

  describe('constructor / tryRestoreSession', () => {
    it('fires a refresh call on construction', () => {
      const req = httpMock.expectOne({ method: 'POST', url: `${AUTH_URL}/refresh` });
      expect(req.request.withCredentials).toBe(true);
      req.flush(tokenOnly);
    });
  });

  describe('login', () => {
    it('POSTs credentials with withCredentials, saves auth data and emits authState', () => {
      httpMock.expectOne({ method: 'POST', url: `${AUTH_URL}/refresh` }).flush(tokenOnly);

      let emitted: unknown = null;
      service.authState$.subscribe(v => (emitted = v));

      service.login({ username: 'admin', password: 'pass', rememberMe: true }).subscribe(res => {
        expect(res).toEqual(fullUser);
      });

      const req = httpMock.expectOne({ method: 'POST', url: `${AUTH_URL}/login` });
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.body).toEqual({ username: 'admin', password: 'pass', rememberMe: true });
      req.flush(fullUser);

      expect(tokenService.getUserData()).toEqual(fullUser);
      expect(tokenService.getToken()).toBe('refresh-token-1');
      expect(emitted).toEqual(fullUser);
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('refreshSession', () => {
    it('coalesces concurrent calls into a single refresh request', () => {
      httpMock.expectOne({ method: 'POST', url: `${AUTH_URL}/refresh` }).flush(tokenOnly);

      let firstResult: unknown;
      let secondResult: unknown;
      service.refreshSession().subscribe(res => (firstResult = res));
      service.refreshSession().subscribe(res => (secondResult = res));

      const req = httpMock.expectOne({ method: 'POST', url: `${AUTH_URL}/refresh` });
      req.flush(tokenOnly);

      expect(firstResult).toEqual(tokenOnly);
      expect(secondResult).toEqual(tokenOnly);
      expect(tokenService.getToken()).toBe('refresh-token-2');
    });

    it('allows a new refresh after the previous one completes', () => {
      httpMock.expectOne({ method: 'POST', url: `${AUTH_URL}/refresh` }).flush(tokenOnly);

      service.refreshSession().subscribe(() => undefined);
      httpMock.expectOne({ method: 'POST', url: `${AUTH_URL}/refresh` }).flush(tokenOnly);

      service.refreshSession().subscribe(() => undefined);
      const req = httpMock.expectOne({ method: 'POST', url: `${AUTH_URL}/refresh` });
      expect(req.request.withCredentials).toBe(true);
      req.flush(fullUser);
    });

    it('restores full identity via saveAuthData when the payload has a role', () => {
      httpMock.expectOne({ method: 'POST', url: `${AUTH_URL}/refresh` }).flush(tokenOnly);

      let emitted: unknown = null;
      service.authState$.subscribe(v => (emitted = v));

      service.refreshSession().subscribe(res => {
        expect(res).toEqual(fullUser);
      });

      const req = httpMock.expectOne({ method: 'POST', url: `${AUTH_URL}/refresh` });
      expect(req.request.withCredentials).toBe(true);
      req.flush(fullUser);

      expect(tokenService.getUserData()).toEqual(fullUser);
      expect(tokenService.getToken()).toBe('refresh-token-1');
      expect(emitted).toEqual(fullUser);
    });

    it('falls back to saveToken for token-only payloads but still emits authState', () => {
      httpMock.expectOne({ method: 'POST', url: `${AUTH_URL}/refresh` }).flush({ token: 'stale' });

      let emitted: unknown = null;
      service.authState$.subscribe(v => (emitted = v));

      service.refreshSession().subscribe(() => undefined);

      const req = httpMock.expectOne({ method: 'POST', url: `${AUTH_URL}/refresh` });
      req.flush(tokenOnly);

      expect(tokenService.getToken()).toBe('refresh-token-2');
      expect(tokenService.getUserData()).toBeNull();
      expect(emitted).toEqual(tokenOnly);
    });

    it('propagates an error on failure', () => {
      httpMock.expectOne({ method: 'POST', url: `${AUTH_URL}/refresh` }).flush(tokenOnly);

      let receivedError: unknown;
      service.refreshSession().subscribe({
        next: () => undefined,
        error: err => (receivedError = err)
      });

      const req = httpMock.expectOne({ method: 'POST', url: `${AUTH_URL}/refresh` });
      req.flush({}, { status: 500, statusText: 'Server Error' });

      expect((receivedError as { status: number }).status).toBe(500);
    });
  });

  describe('logout', () => {
    it('clears auth data, emits null and navigates to /', () => {
      httpMock.expectOne({ method: 'POST', url: `${AUTH_URL}/refresh` }).flush(fullUser);

      tokenService.saveAuthData(fullUser);
      let emitted: unknown = 'not-null';
      service.authState$.subscribe(v => (emitted = v));

      service.logout();

      const req = httpMock.expectOne({ method: 'POST', url: `${AUTH_URL}/logout` });
      expect(req.request.withCredentials).toBe(true);
      req.flush({});

      expect(tokenService.getToken()).toBeNull();
      expect(tokenService.getUserData()).toBeNull();
      expect(emitted).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });
  });
});
