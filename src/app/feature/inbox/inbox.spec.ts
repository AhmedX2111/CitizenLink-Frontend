/*
 * InboxPageComponent spec — US-49/50/51/52
 *
 * COVERED:
 *   - US-49 AC1/AC3/AC4/AC5: rendered rows, seven columns, pagination,
 *     row click navigates to case detail, empty/error states
 *   - US-50: quick-filter chips toggle urgency params (overdue/dueToday),
 *     Urgent/Awaiting info/Newly assigned chips set priority/status,
 *     counts badge loading, one-action Clear filters
 *   - US-51: sort select forwards the sort param
 *   - US-52: query params restore state; state changes write back to the URL
 */

import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';

import { InboxPageComponent } from './inbox';
import { DashboardService } from '../../../core/services/dashboard.service';
import { InboxCaseResponse, InboxCountsResponse, InboxFilter } from '../../../core/models/dashboard.models';
import { PagedResponse } from '../../../core/models/case.models';

function row(overrides: Partial<InboxCaseResponse> = {}): InboxCaseResponse {
  return {
    id: 'c-1',
    caseNumber: 'CL-2026-0001',
    subject: 'Broken streetlight',
    citizenFullName: 'Ahmed Ali',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    dueAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-08-30T10:00:00Z',
    ...overrides
  };
}

function page(content: InboxCaseResponse[], totalElements = content.length, totalPages = 1): PagedResponse<InboxCaseResponse> {
  return { content, page: 0, size: 20, totalElements, totalPages, first: true, last: totalPages <= 1 };
}

const COUNTS: InboxCountsResponse = {
  all: 9, overdue: 2, dueToday: 1, urgent: 3, awaitingInfo: 1, newlyAssigned: 2
};

describe('InboxPageComponent', () => {
  let fixture: ComponentFixture<InboxPageComponent>;
  let component: InboxPageComponent;
  let dashboardService: { getMyInbox: ReturnType<typeof vi.fn>; getMyInboxCounts: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let queryParams$: Subject<Record<string, string>>;

  beforeEach(async () => {
    dashboardService = {
      getMyInbox: vi.fn().mockReturnValue(of(page([row()]))),
      getMyInboxCounts: vi.fn().mockReturnValue(of(COUNTS))
    };
    router = { navigate: vi.fn() };
    queryParams$ = new Subject();

    await TestBed.configureTestingModule({
      imports: [InboxPageComponent],
      providers: [
        { provide: DashboardService, useValue: dashboardService },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { queryParams: queryParams$.asObservable() } },
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

    fixture = TestBed.createComponent(InboxPageComponent);
    component = fixture.componentInstance;
  });

  const renderRowText = (): string =>
    (fixture.nativeElement as HTMLElement).querySelector('tbody')?.textContent ?? '';

  it('should create and load rows + counts', async () => {
    component.ngOnInit();
    queryParams$.next({});
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(renderRowText()).toContain('CL-2026-0001');
    expect(component.counts()).toEqual(COUNTS);
    expect((dashboardService.getMyInboxCounts as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('US-49 AC3: shows all seven inbox columns in the header', async () => {
    component.ngOnInit();
    queryParams$.next({});
    await fixture.whenStable();
    fixture.detectChanges();

    const headers = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('thead th'))
      .map(th => (th as HTMLElement).textContent?.trim());
    expect(headers).toEqual([
      'dashboard.myInbox.columns.caseNumber',
      'dashboard.myInbox.columns.subject',
      'dashboard.myInbox.columns.citizen',
      'dashboard.myInbox.columns.priority',
      'dashboard.myInbox.columns.status',
      'dashboard.myInbox.columns.dueDate',
      'dashboard.myInbox.columns.lastUpdate'
    ]);
  });

  it('US-50: the overdue chip sets overdue=true, resets page, and updates the URL', async () => {
    component.ngOnInit();
    queryParams$.next({});
    await fixture.whenStable();
    fixture.detectChanges();

    component.toggleUrgency('overdue');
    await fixture.whenStable();

    expect(dashboardService.getMyInbox).toHaveBeenLastCalledWith(
      expect.objectContaining({ overdue: true, page: 0 })
    );
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ overdue: 'true' })
    }));
  });

  it('US-50: toggling the same chip off clears the urgency filter', async () => {
    component.ngOnInit();
    queryParams$.next({ overdue: 'true' });
    await fixture.whenStable();

    component.toggleUrgency('overdue');
    await fixture.whenStable();

    const lastCall = (dashboardService.getMyInbox as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as InboxFilter;
    expect(lastCall.overdue).toBeFalsy();
    expect(lastCall.dueToday).toBeFalsy();
  });

  it('US-50: the Urgent chip toggles priority on and off', async () => {
    component.ngOnInit();
    queryParams$.next({});
    await fixture.whenStable();

    component.togglePriority('URGENT');
    await fixture.whenStable();
    expect(dashboardService.getMyInbox).toHaveBeenLastCalledWith(
      expect.objectContaining({ priority: 'URGENT', page: 0 })
    );

    component.togglePriority('URGENT');
    await fixture.whenStable();
    const lastCall = (dashboardService.getMyInbox as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as InboxFilter;
    expect(lastCall.priority).toBeFalsy();
  });

  it('US-50: the Awaiting info and Newly assigned chips toggle status on and off', async () => {
    component.ngOnInit();
    queryParams$.next({});
    await fixture.whenStable();

    component.toggleStatus('AWAITING_INFO');
    await fixture.whenStable();
    expect(dashboardService.getMyInbox).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'AWAITING_INFO' })
    );

    component.toggleStatus('AWAITING_INFO');
    await fixture.whenStable();
    let lastCall = (dashboardService.getMyInbox as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as InboxFilter;
    expect(lastCall.status).toBeFalsy();

    component.toggleStatus('ASSIGNED');
    await fixture.whenStable();
    expect(dashboardService.getMyInbox).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'ASSIGNED' })
    );

    component.toggleStatus('ASSIGNED');
    await fixture.whenStable();
    lastCall = (dashboardService.getMyInbox as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as InboxFilter;
    expect(lastCall.status).toBeFalsy();
  });

  it('US-50: Overdue and Due today are an exclusive pair in the UI', async () => {
    component.ngOnInit();
    queryParams$.next({});
    await fixture.whenStable();

    component.toggleUrgency('overdue');
    component.toggleUrgency('dueToday');

    expect(component.urgencyFilter()).toBe('dueToday');
  });

  it('US-50: Clear filters resets every active filter in one action', async () => {
    component.ngOnInit();
    queryParams$.next({ overdue: 'true', priority: 'URGENT', keyword: 'tap' });
    await fixture.whenStable();

    expect(component.hasActiveQuickFilters()).toBe(true);
    component.clearFilters();
    await fixture.whenStable();

    expect(component.statusFilter()).toBe('');
    expect(component.priorityFilter()).toBe('');
    expect(component.keywordFilter()).toBe('');
    expect(component.urgencyFilter()).toBe('');
    expect(component.hasActiveQuickFilters()).toBe(false);
    const lastCall = (dashboardService.getMyInbox as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as InboxFilter;
    expect(lastCall.page).toBe(0);
    expect(lastCall.overdue).toBeFalsy();
    expect(lastCall.priority).toBeFalsy();
    expect(lastCall.keyword).toBeFalsy();
  });

  it('US-51: the sort select forwards the sort param to the server', async () => {
    component.ngOnInit();
    queryParams$.next({});
    await fixture.whenStable();

    component.onSortChange('PRIORITY');
    await fixture.whenStable();

    expect(dashboardService.getMyInbox).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: 'PRIORITY', page: 0 })
    );
  });

  it('US-52: restores filters, sort and page from URL query params', async () => {
    component.ngOnInit();
    queryParams$.next({ overdue: 'true', priority: 'URGENT', sort: 'PRIORITY', page: '2', keyword: 'water' });
    await fixture.whenStable();

    expect(component.urgencyFilter()).toBe('overdue');
    expect(component.priorityFilter()).toBe('URGENT');
    expect(component.sortFilter()).toBe('PRIORITY');
    expect(component.currentPage()).toBe(2);
    expect(component.keywordFilter()).toBe('water');
    expect(dashboardService.getMyInbox).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, overdue: true, priority: 'URGENT', sort: 'PRIORITY', keyword: 'water' })
    );
  });

  it('US-52: page change writes the page back to the URL', async () => {
    component.ngOnInit();
    queryParams$.next({});
    await fixture.whenStable();
    fixture.detectChanges();

    component.totalPages.set(3);
    fixture.detectChanges();
    component.goToPage(2);
    await fixture.whenStable();

    expect(component.currentPage()).toBe(2);
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ page: '2' })
    }));
    expect(dashboardService.getMyInbox).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 })
    );
  });

  it('US-52: opening a case records it for return-highlighting', async () => {
    component.ngOnInit();
    queryParams$.next({});
    await fixture.whenStable();
    fixture.detectChanges();

    const firstRow = (fixture.nativeElement as HTMLElement).querySelector('tbody tr') as HTMLElement;
    firstRow.click();

    expect(component.lastOpenedCaseId()).toBe('c-1');
    expect(router.navigate).toHaveBeenCalledWith(['/cases', 'c-1'], expect.anything());
  });

  it('shows the empty state when the inbox has no rows', async () => {
    dashboardService.getMyInbox.mockReturnValue(of(page([])));
    component.ngOnInit();
    queryParams$.next({});
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('dashboard.myInbox.empty');
  });

  it('shows noPermission on a 403', async () => {
    dashboardService.getMyInbox.mockReturnValue(throwError(() => ({ status: 403 })));
    component.ngOnInit();
    queryParams$.next({});
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.error()).toBe('dashboard.myInbox.noPermission');
  });

  it('shows loadError on other failures', async () => {
    dashboardService.getMyInbox.mockReturnValue(throwError(() => ({ status: 500 })));
    component.ngOnInit();
    queryParams$.next({});
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.error()).toBe('dashboard.myInbox.loadError');
  });
});