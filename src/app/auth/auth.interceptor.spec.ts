/*
 * authInterceptor spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - public auth routes (login/refresh) pass through without an Authorization header
 *   - requests with an access token attach an Authorization header
 *   - a 401 on a protected route triggers a single refresh, then retries the request
 *     with the new token
 *   - a 401 while a refresh is already in flight coalesces into the same refresh call
 *   - a failed refresh clears auth data and redirects to /login
 *   - logout requests are never replayed through the refresh flow
 *
 * SKIPPED (with reason):
 *   - Token persistence across requests: covered indirectly via AuthTokenService
 *     behaviour exercised in each flow below.
 */

import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { authInterceptor } from './auth.interceptor';
import { AuthTokenService } from './auth-token.service';
import { environment } from '../../environments/environment';

const REFRESH_URL = `${environment.apiUrl}/api/v1/auth/refresh`;

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let tokenService: {
    getToken: ReturnType<typeof vi.fn>;
    saveToken: ReturnType<typeof vi.fn>;
    saveAuthData: ReturnType<typeof vi.fn>;
    clearAuthData: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    tokenService = {
      getToken: vi.fn().mockReturnValue('access-token'),
      saveToken: vi.fn(),
      saveAuthData: vi.fn(),
      clearAuthData: vi.fn()
    };
    router = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthTokenService, useValue: tokenService },
        { provide: Router, useValue: router }
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

  it('refreshes once, restores identity, and retries the original request with the new token', () => {
    let received: unknown;
    http.get('/api/v1/cases/1').subscribe(res => (received = res));

    const original = httpMock.expectOne('/api/v1/cases/1');
    expect(original.request.headers.get('Authorization')).toBe('Bearer access-token');
    original.flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne({ method: 'POST', url: REFRESH_URL });
    expect(refreshReq.request.withCredentials).toBe(true);
    tokenService.getToken.mockReturnValue('new-access-token');
    refreshReq.flush({ token: 'new-access-token', role: 'ADMIN' });

    const retried = httpMock.expectOne('/api/v1/cases/1');
    expect(retried.request.headers.get('Authorization')).toBe('Bearer new-access-token');
    retried.flush({ id: 'case-1' });

    expect(received).toEqual({ id: 'case-1' });
    expect(tokenService.saveAuthData).toHaveBeenCalledWith({ token: 'new-access-token', role: 'ADMIN' });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('coalesces concurrent 401s into a single refresh call', () => {
    http.get('/api/v1/a').subscribe();
    http.get('/api/v1/b').subscribe();

    const reqA = httpMock.expectOne('/api/v1/a');
    const reqB = httpMock.expectOne('/api/v1/b');

    reqA.flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });
    reqB.flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne({ method: 'POST', url: REFRESH_URL });
    tokenService.getToken.mockReturnValue('new-access-token');
    refreshReq.flush({ token: 'new-access-token', role: 'ADMIN' });

    const retriedA = httpMock.expectOne('/api/v1/a');
    retriedA.flush({});
    const retriedB = httpMock.expectOne('/api/v1/b');
    retriedB.flush({});

    expect(tokenService.saveToken).not.toHaveBeenCalled();
    expect(tokenService.saveAuthData).toHaveBeenCalledTimes(1);
  });

  it('clears auth data and redirects to /login when the refresh fails', () => {
    let receivedError: unknown;
    let emitted = false;
    http.get('/api/v1/cases/1').subscribe({
      next: () => (emitted = true),
      error: err => (receivedError = err)
    });

    const original = httpMock.expectOne('/api/v1/cases/1');
    original.flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne({ method: 'POST', url: REFRESH_URL });
    refreshReq.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(tokenService.clearAuthData).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(emitted).toBe(false);
    expect((receivedError as { status: number }).status).toBe(401);
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
    expect(tokenService.clearAuthData).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    httpMock.expectNone({ method: 'POST', url: REFRESH_URL });
  });
});
