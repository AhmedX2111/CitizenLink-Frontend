/*
 * DashboardService spec — getMyInbox param building (US-49)
 *
 * COVERED:
 *   - GET /api/v1/dashboard/my-inbox with page/size always present
 *   - optional status / priority / keyword params included when set
 *   - empty/blank keyword omitted
 */

import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { DashboardService } from './dashboard.service';
import { environment } from '../../environments/environment';

const INBOX_URL = `${environment.apiUrl}/api/v1/dashboard/my-inbox`;

describe('DashboardService.getMyInbox', () => {
  let service: DashboardService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(DashboardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GETs my-inbox with page/size defaults and no optional params', () => {
    service.getMyInbox().subscribe();

    const req = httpMock.expectOne(r => r.url === INBOX_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.get('status')).toBeNull();
    expect(req.request.params.get('priority')).toBeNull();
    expect(req.request.params.get('keyword')).toBeNull();

    req.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true });
  });

  it('forwards non-empty filters and trims the keyword', () => {
    service.getMyInbox({
      page: 2,
      size: 50,
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      keyword: '  water  '
    }).subscribe();

    const req = httpMock.expectOne(r => r.url === INBOX_URL);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('50');
    expect(req.request.params.get('status')).toBe('IN_PROGRESS');
    expect(req.request.params.get('priority')).toBe('HIGH');
    expect(req.request.params.get('keyword')).toBe('water');

    req.flush({ content: [], page: 2, size: 50, totalElements: 0, totalPages: 0, first: false, last: true });
  });

  it('omits a blank keyword instead of sending an empty param', () => {
    service.getMyInbox({ keyword: '   ' }).subscribe();

    const req = httpMock.expectOne(r => r.url === INBOX_URL);
    expect(req.request.params.get('keyword')).toBeNull();

    req.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true });
  });

  it('US-50/51: forwards overdue, dueToday and sort params when set', () => {
    service.getMyInbox({ overdue: true, dueToday: true, sort: 'PRIORITY' }).subscribe();

    const req = httpMock.expectOne(r => r.url === INBOX_URL);
    expect(req.request.params.get('overdue')).toBe('true');
    expect(req.request.params.get('dueToday')).toBe('true');
    expect(req.request.params.get('sort')).toBe('PRIORITY');

    req.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true });
  });

  it('US-50: getMyInboxCounts GETs the counts endpoint', () => {
    const counts = { all: 9, overdue: 2, dueToday: 1, urgent: 3, awaitingInfo: 1, newlyAssigned: 2 };
    service.getMyInboxCounts().subscribe(c => expect(c).toEqual(counts));

    const req = httpMock.expectOne(r => r.url === INBOX_URL + '/counts');
    expect(req.request.method).toBe('GET');
    req.flush(counts);
  });
});