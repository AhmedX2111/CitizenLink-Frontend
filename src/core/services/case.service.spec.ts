/*
 * CaseService spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - createCase POSTs to /api/v1/cases with the request body
 *   - searchCases builds query params: status, type, priority, assignedToUserId,
 *     trimmed keyword, page, size — omitting falsy/empty values
 *   - getCaseById GETs /cases/{id}
 *   - getCaseTimeline GETs /cases/{id}/timeline
 *   - getCaseActions GETs /cases/{id}/actions
 *   - transitionCase POSTs /cases/{id}/transition with the request body
 *   - getHandlers GETs /users/handlers
 *   - getDepartments GETs /departments
 *   - getCategories GETs /categories
 *
 * SKIPPED (with reason):
 *   - HTTP error propagation: exercised via the interceptor specs; the service layer
 *     just forwards errors from HttpClient unchanged.
 */

import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CaseService } from './case.service';
import { environment } from '../../environments/environment';

const CASES_URL = `${environment.apiUrl}/api/v1/cases`;
const USERS_URL = `${environment.apiUrl}/api/v1/users`;

describe('CaseService', () => {
  let service: CaseService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(CaseService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('createCase POSTs the request body to the cases endpoint', () => {
    const request = {
      subject: 'Broken tap',
      description: 'Leak',
      type: 'REQUEST' as const,
      priority: 'HIGH' as const,
      channel: 'PHONE' as const,
      citizenNationalId: '1234567890',
      categoryId: 'cat-1',
      departmentId: 'dep-1'
    };

    service.createCase(request).subscribe();

    const req = httpMock.expectOne({ method: 'POST', url: CASES_URL });
    expect(req.request.body).toEqual(request);
    req.flush({ id: 'case-1' });
  });

  describe('searchCases', () => {
    it('sets every provided filter as a query param and trims the keyword', () => {
      service
        .searchCases({
          status: 'NEW',
          type: 'REQUEST',
          priority: 'HIGH',
          assignedToUserId: 'u-1',
          keyword: '  tap  ',
          page: 2,
          size: 25
        })
        .subscribe();

      const req = httpMock.expectOne(
        (r) => r.method === 'GET' && r.url === CASES_URL
      );
      const params = req.request.params;
      expect(params.get('status')).toBe('NEW');
      expect(params.get('type')).toBe('REQUEST');
      expect(params.get('priority')).toBe('HIGH');
      expect(params.get('assignedToUserId')).toBe('u-1');
      expect(params.get('keyword')).toBe('tap');
      expect(params.get('page')).toBe('2');
      expect(params.get('size')).toBe('25');
      req.flush({ content: [], page: 0, size: 25, totalElements: 0, totalPages: 0, first: true, last: true });
    });

    it('omits filters that are falsy, empty, or whitespace-only', () => {
      service
        .searchCases({ keyword: '   ' })
        .subscribe();

      const req = httpMock.expectOne((r) => r.method === 'GET' && r.url === CASES_URL);
      expect(req.request.params.keys().length).toBe(0);
      req.flush({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true });
    });

    it('omits keyword when it is empty after trimming', () => {
      service.searchCases({ keyword: '' }).subscribe();

      const req = httpMock.expectOne((r) => r.method === 'GET' && r.url === CASES_URL);
      expect(req.request.params.has('keyword')).toBe(false);
      req.flush({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true });
    });
  });

  it('getCaseById GETs the single-case endpoint', () => {
    service.getCaseById('case-1').subscribe();

    const req = httpMock.expectOne({ method: 'GET', url: `${CASES_URL}/case-1` });
    req.flush({});
  });

  it('getCaseTimeline GETs the timeline endpoint', () => {
    service.getCaseTimeline('case-1').subscribe();

    const req = httpMock.expectOne({ method: 'GET', url: `${CASES_URL}/case-1/timeline` });
    req.flush([]);
  });

  it('getCaseActions GETs the actions endpoint', () => {
    service.getCaseActions('case-1').subscribe();

    const req = httpMock.expectOne({ method: 'GET', url: `${CASES_URL}/case-1/actions` });
    req.flush([]);
  });

  it('transitionCase POSTs the transition request', () => {
    const request = { action: 'ASSIGN' as const, assignedToUserId: 'u-2' };
    service.transitionCase('case-1', request).subscribe();

    const req = httpMock.expectOne({ method: 'POST', url: `${CASES_URL}/case-1/transition` });
    expect(req.request.body).toEqual(request);
    req.flush({});
  });

  it('getHandlers GETs the handlers endpoint', () => {
    service.getHandlers().subscribe();

    const req = httpMock.expectOne({ method: 'GET', url: `${USERS_URL}/handlers` });
    req.flush([]);
  });

  it('getDepartments GETs the departments endpoint', () => {
    service.getDepartments().subscribe();

    const req = httpMock.expectOne({ method: 'GET', url: `${environment.apiUrl}/api/v1/departments` });
    req.flush([]);
  });

  it('getCategories GETs the categories endpoint', () => {
    service.getCategories().subscribe();

    const req = httpMock.expectOne({ method: 'GET', url: `${environment.apiUrl}/api/v1/categories` });
    req.flush([]);
  });
});
