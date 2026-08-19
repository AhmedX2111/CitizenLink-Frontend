/*
 * authInterceptor spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - public auth routes (login/refresh) pass through without an Authorization header
 *   - requests with an access token attach an Authorization header
 *   - a 401 on a protected route delegates to AuthService.refreshSession(), then
 *     retries the request with the new token
 *   - concurrent 401s each delegate to refreshSession() and never issue their own
 *     refresh HTTP call (single-request coalescing is AuthService's contract,
 *     covered in auth.service.spec)
 *   - a failed refresh forces a logout via AuthService.forceLogout (clears both
 *     the token store and the authState identity) (M-23)
 *   - logout requests are never replayed through the refresh flow
 *
 * SKIPPED (with reason):
 *   - Token persistence across requests: covered indirectly via AuthTokenService
 *     behaviour exercised in each flow below.
 *   - Single-HTTP-call coalescing of concurrent refreshes: AuthService.refreshSession()
 *     owns refreshInFlight$ deduplication and is asserted in auth.service.spec.
 */

import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { authInterceptor } from './auth.interceptor';
import { AuthTokenService } from './auth-token.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

const REFRESH_URL = `${environment.apiUrl}/api/v1/auth/refresh`;

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let tokenService: {
    getToken: ReturnType<typeof vi.fn>;
  };
  let authService: { refreshSession: ReturnType<typeof vi.fn>; forceLogout: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    tokenService = {
      getToken: vi.fn().mockReturnValue('access-token')
    };
    authService = { refreshSession: vi.fn(), forceLogout: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthTokenService, useValue: tokenService },
        { provide: AuthService, useValue: authService }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('passes login requests through without an Authorization header', () => {
    http.get('/api/v1/auth/login').subscribe();

    const req = httpMock.expectOne('/api/v1/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('passes refresh requests through without an Authorization header', () => {
    http.get('/api/v1/auth/refresh').subscribe();

    const req = httpMock.expectOne('/api/v1/auth/refresh');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('attaches an Authorization header when an access token is present', () => {
    http.get('/api/v1/cases').subscribe();

    const req = httpMock.expectOne('/api/v1/cases');
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-token');
    req.flush([]);
  });

  it('attaches the token to absolute API-base URLs', () => {
    http.get(`${environment.apiUrl}/api/v1/cases`).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/cases`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-token');
    req.flush([]);
  });

  it('never attaches the token to third-party absolute URLs', () => {
    http.get('https://cdn.example.com/analytics').subscribe();

    const req = httpMock.expectOne('https://cdn.example.com/analytics');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('does not trigger a refresh for a third-party 401', () => {
    let receivedError: unknown;
    let emitted = false;
    http.get('https://cdn.example.com/analytics').subscribe({
      next: () => (emitted = true),
      error: err => (receivedError = err)
    });

    const req = httpMock.expectOne('https://cdn.example.com/analytics');
    req.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(emitted).toBe(false);
    expect((receivedError as { status: number }).status).toBe(401);
    expect(authService.refreshSession).not.toHaveBeenCalled();
    expect(authService.forceLogout).not.toHaveBeenCalled();
    httpMock.expectNone({ method: 'POST', url: REFRESH_URL });
  });

  it('treats only the API base as a public auth route', () => {
    http.get(`${environment.apiUrl}/api/v1/auth/refresh`).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/refresh`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(authService.refreshSession).not.toHaveBeenCalled();
    req.flush({});
  });

  it('delegates to AuthService.refreshSession and retries with the new token', () => {
    let received: unknown;
    authService.refreshSession.mockImplementation(() => {
      tokenService.getToken.mockReturnValue('new-access-token');
      return of({ token: 'new-access-token', role: 'ADMIN' } as never);
    });

    http.get('/api/v1/cases/1').subscribe(res => (received = res));

    const original = httpMock.expectOne('/api/v1/cases/1');
    expect(original.request.headers.get('Authorization')).toBe('Bearer access-token');
    original.flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(authService.refreshSession).toHaveBeenCalledTimes(1);

    const retried = httpMock.expectOne('/api/v1/cases/1');
    expect(retried.request.headers.get('Authorization')).toBe('Bearer new-access-token');
    retried.flush({ id: 'case-1' });

    expect(received).toEqual({ id: 'case-1' });
    expect(authService.forceLogout).not.toHaveBeenCalled();
    httpMock.expectNone({ method: 'POST', url: REFRESH_URL });
  });

  it('coalesces concurrent 401s through refreshSession without issuing its own refresh call', () => {
    authService.refreshSession.mockImplementation(() => {
      tokenService.getToken.mockReturnValue('new-access-token');
      return of({ token: 'new-access-token', role: 'ADMIN' } as never);
    });

    http.get('/api/v1/a').subscribe();
    http.get('/api/v1/b').subscribe();

    const reqA = httpMock.expectOne('/api/v1/a');
    const reqB = httpMock.expectOne('/api/v1/b');

    reqA.flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });
    reqB.flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(authService.refreshSession).toHaveBeenCalledTimes(2);

    const retriedA = httpMock.expectOne('/api/v1/a');
    expect(retriedA.request.headers.get('Authorization')).toBe('Bearer new-access-token');
    retriedA.flush({});
    const retriedB = httpMock.expectOne('/api/v1/b');
    expect(retriedB.request.headers.get('Authorization')).toBe('Bearer new-access-token');
    retriedB.flush({});

    httpMock.expectNone({ method: 'POST', url: REFRESH_URL });
  });

  it('treats a refresh with no token as a failure: no retry, forces logout', () => {
    let receivedError: unknown;
    let emitted = false;
    authService.refreshSession.mockReturnValue(of({ token: null } as never));

    http.get('/api/v1/cases/1').subscribe({
      next: () => (emitted = true),
      error: err => (receivedError = err)
    });

    const original = httpMock.expectOne('/api/v1/cases/1');
    original.flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(authService.forceLogout).toHaveBeenCalled();
    expect(emitted).toBe(false);
    expect((receivedError as { status: number }).status).toBe(401);
    httpMock.expectNone({ method: 'GET', url: '/api/v1/cases/1' });
    httpMock.expectNone({ method: 'POST', url: REFRESH_URL });
  });

  it('forces a logout when the refresh fails and the original 401 propagates', () => {
    let receivedError: unknown;
    let emitted = false;
    authService.refreshSession.mockReturnValue(throwError(() => ({ status: 401 })));

    http.get('/api/v1/cases/1').subscribe({
      next: () => (emitted = true),
      error: err => (receivedError = err)
    });

    const original = httpMock.expectOne('/api/v1/cases/1');
    original.flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(authService.forceLogout).toHaveBeenCalled();
    expect(emitted).toBe(false);
    expect((receivedError as { status: number }).status).toBe(401);
    httpMock.expectNone({ method: 'POST', url: REFRESH_URL });
  });

  it('does not replay logout requests through the refresh flow', () => {
    let receivedError: unknown;
    let emitted = false;
    http.get('/api/v1/auth/logout').subscribe({
      next: () => (emitted = true),
      error: err => (receivedError = err)
    });

    const logoutReq = httpMock.expectOne('/api/v1/auth/logout');
    logoutReq.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(emitted).toBe(false);
    expect((receivedError as { status: number }).status).toBe(401);
    expect(authService.forceLogout).not.toHaveBeenCalled();
    expect(authService.refreshSession).not.toHaveBeenCalled();
    httpMock.expectNone({ method: 'POST', url: REFRESH_URL });
  });
});
