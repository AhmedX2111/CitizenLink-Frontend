/*
 * httpErrorInterceptor spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - network errors (status 0) are logged as "Network error / no response"
 *   - server errors (status >= 500) are logged with the status code
 *   - client errors (4xx) and successes pass through without logging
 *   - the original error is always rethrown unchanged
 *
 * SKIPPED (with reason):
 *   - Duplicate logging interactions with authInterceptor: each interceptor is
 *     verified independently; combined behaviour is covered at runtime.
 */

import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { httpErrorInterceptor } from './http-error.interceptor';
import { LoggerService } from './logger.service';

describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let logger: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    logger = { error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: LoggerService, useValue: logger }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(http).toBeTruthy();
  });

  it('logs network errors (status 0) and rethrows them', () => {
    let receivedError: unknown;
    let emitted = false;
    http.get('/api/v1/cases').subscribe({
      next: () => (emitted = true),
      error: err => (receivedError = err)
    });

    const req = httpMock.expectOne('/api/v1/cases');
    req.flush({}, { status: 0, statusText: 'Unknown Error' });

    expect(logger.error).toHaveBeenCalledWith('HttpErrorInterceptor', 'Network error / no response');
    expect(emitted).toBe(false);
    expect((receivedError as { status: number }).status).toBe(0);
  });

  it('logs server errors (status >= 500) with the status code and rethrows them', () => {
    let receivedError: unknown;
    let emitted = false;
    http.get('/api/v1/cases').subscribe({
      next: () => (emitted = true),
      error: err => (receivedError = err)
    });

    const req = httpMock.expectOne('/api/v1/cases');
    req.flush({}, { status: 503, statusText: 'Service Unavailable' });

    expect(logger.error).toHaveBeenCalledWith(
      'HttpErrorInterceptor',
      'Server error 503:',
      'Http failure response for /api/v1/cases: 503 Service Unavailable'
    );
    expect(emitted).toBe(false);
    expect((receivedError as { status: number }).status).toBe(503);
  });

  it('passes client errors (4xx) through without logging', () => {
    let receivedError: unknown;
    let emitted = false;
    http.get('/api/v1/cases/1').subscribe({
      next: () => (emitted = true),
      error: err => (receivedError = err)
    });

    const req = httpMock.expectOne('/api/v1/cases/1');
    req.flush({}, { status: 404, statusText: 'Not Found' });

    expect(logger.error).not.toHaveBeenCalled();
    expect(emitted).toBe(false);
    expect((receivedError as { status: number }).status).toBe(404);
  });

  it('passes successful responses through without logging', () => {
    let received: unknown;
    http.get('/api/v1/cases').subscribe(res => (received = res));

    const req = httpMock.expectOne('/api/v1/cases');
    req.flush([]);

    expect(logger.error).not.toHaveBeenCalled();
    expect(received).toEqual([]);
  });
});
