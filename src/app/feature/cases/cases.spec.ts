/*
 * CasesComponent spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - initial load: requests departments, categories and the first case page
 *   - case list visibility is server-scoped: the component renders exactly the
 *     cases returned by searchCases (role-scoping happens backend-side)
 *   - 403 on the case list -> "Access Denied" UI (cases.errors.forbidden)
 *   - non-403 failures -> generic loadFailed message
 *   - 403 on departments/categories -> forbidden lookup message
 *   - search filter changes reload the list with the matching query params
 *   - clearFilters resets the form and reloads
 *   - goToPage reloads with the requested page
 *   - US-58: duplicate preflight gates the Citizen 360 create flow — warns on
 *     open candidates, requires a confirmed reason to override, never blocks
 *     on preflight failure, and is skipped for the generic (unlinked) flow
 *
 * SKIPPED (with reason):
 *   - Client-side role filtering of the case list: the backend only returns
 *     cases visible to the current role, so the frontend has no client-side
 *     role filter to unit test.
 *   - Create-case form flows: covered separately (not access-control related).
 */

import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';

import { CasesComponent } from './cases';
import { CaseService } from '../../../core/services/case.service';
import { AuthUserService } from '../../auth/auth-user.service';
import { CitizenService } from '../../../core/services/citizen.service';
import { LoggerService } from '../../../core/services/logger.service';
import { CaseResponse, CaseStatus } from '../../../core/models/case.models';
import { Citizen } from '../../../core/models/citizen.models';
import { Department } from '../../../core/models/department.model';
import { Category } from '../../../core/models/category.model';

const caseA: CaseResponse = {
  id: 'case-a',
  caseNumber: 'CASE-2026-0001',
  subject: 'Broken tap',
  description: 'Leak in kitchen',
  type: 'REQUEST',
  priority: 'HIGH',
  status: 'IN_PROGRESS',
  channel: 'PHONE',
  resolutionSummary: null,
  dueAt: null,
  citizenId: 'cit-1',
  citizenFullName: 'John Doe',
  citizenNationalId: '1234567890',
  citizenPhone: '0100000000',
  categoryId: 'cat-1',
  categoryNameEn: 'Water',
  categoryNameAr: 'مياه',
  departmentId: 'dep-1',
  departmentNameEn: 'Utilities',
  departmentNameAr: 'مرافق',
  createdByUserId: 'u-1',
  createdByDisplayName: 'Agent One',
  assignedToUserId: 'u-2',
  assignedToDisplayName: 'Handler Two',
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-01-02T12:00:00Z',
  resolvedAt: null,
  closedAt: null,
  duplicateReason: null
};

const caseB: CaseResponse = { ...caseA, id: 'case-b', caseNumber: 'CASE-2026-0002' };

const departments: Department[] = [{ id: 'dep-1', code: 'DEP1', nameEn: 'Utilities', nameAr: 'مرافق', active: true }];
const categories: Category[] = [{ id: 'cat-1', code: 'CAT1', nameEn: 'Water', nameAr: 'مياه', active: true }];

const citizen360: Citizen = {
  id: 'cit-360',
  fullName: 'Jane Citizen',
  nationalId: '1234567890123456',
  phone: '0100000000',
  email: 'jane@example.gov',
  preferredLanguage: 'en',
  createdAt: '2026-01-01T00:00:00Z',
  caseCount: 2
};

describe('CasesComponent', () => {
  let fixture: ComponentFixture<CasesComponent>;
  let component: CasesComponent;

  let citizenService: { getCitizenById: ReturnType<typeof vi.fn> };

  let caseService: {
    searchCases: ReturnType<typeof vi.fn>;
    getDepartments: ReturnType<typeof vi.fn>;
    getCategories: ReturnType<typeof vi.fn>;
    createCase: ReturnType<typeof vi.fn>;
    createCaseForCitizen: ReturnType<typeof vi.fn>;
    checkDuplicateCases: ReturnType<typeof vi.fn>;
    getHandlers: ReturnType<typeof vi.fn>;
    bulkReassignCases: ReturnType<typeof vi.fn>;
  };
  let authUserService: {
    hasRole: ReturnType<typeof vi.fn>;
    hasRoleSignal: ReturnType<typeof vi.fn>;
    hasRoleAny: ReturnType<typeof vi.fn>;
    createCaseForCitizen: ReturnType<typeof vi.fn>;
    checkDuplicateCases: ReturnType<typeof vi.fn>;
  };
  let router: {
    navigate: ReturnType<typeof vi.fn>;
    currentNavigation: WritableSignal<{ extras: { state: Record<string, string> } } | null>;
  };
  let queryParams$: BehaviorSubject<Record<string, string>>;
  let routeSnapshot: { queryParams: Record<string, string> };

  beforeEach(async () => {
    caseService = {
      searchCases: vi.fn().mockReturnValue(
        of({
          content: [caseA, caseB],
          totalElements: 2,
          totalPages: 1,
          page: 0,
          size: 20,
          first: true,
          last: true
        })
      ),
      getDepartments: vi.fn().mockReturnValue(of(departments)),
      getCategories: vi.fn().mockReturnValue(of(categories)),
      createCase: vi.fn(),
      createCaseForCitizen: vi.fn(),
      checkDuplicateCases: vi.fn().mockReturnValue(of([])),
      getHandlers: vi.fn().mockReturnValue(of([])),
      bulkReassignCases: vi.fn()
    };
    authUserService = {
      hasRole: vi.fn().mockReturnValue(false),
      hasRoleSignal: vi.fn().mockReturnValue(() => false),
      hasRoleAny: vi.fn().mockReturnValue(false),
      createCaseForCitizen: vi.fn(),
      checkDuplicateCases: vi.fn().mockReturnValue(of([]))
    };
    citizenService = { getCitizenById: vi.fn().mockReturnValue(of(citizen360)) };
    router = { navigate: vi.fn(), currentNavigation: signal(null) };
    queryParams$ = new BehaviorSubject({});
    routeSnapshot = { queryParams: {} };

    await TestBed.configureTestingModule({
      imports: [CasesComponent],
      providers: [
        { provide: CaseService, useValue: caseService },
        { provide: AuthUserService, useValue: authUserService },
        { provide: CitizenService, useValue: citizenService },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { queryParams: queryParams$, snapshot: routeSnapshot } },
        { provide: LoggerService, useValue: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } },
        {
          provide: TranslocoService,
          useValue: {
            translate: (key: string) => key,
            setActiveLang: () => undefined,
            getActiveLang: () => 'en',
            config: { reRenderOnLangChange: false },
            langChanges$: new BehaviorSubject('en'),
            _loadDependencies: () => of(undefined)
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CasesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const listErrorText = (): string | null => {
    const el = fixture.nativeElement.querySelector('span.text-red-700') as HTMLElement | null;
    return el?.textContent?.trim() ?? null;
  };

  const lastSearchArgs = () => caseService.searchCases.mock.calls[caseService.searchCases.mock.calls.length - 1][0];

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads departments, categories and the first page on init', () => {
    expect(caseService.getDepartments).toHaveBeenCalled();
    expect(caseService.getCategories).toHaveBeenCalled();
    expect(caseService.searchCases).toHaveBeenCalledWith({
      page: 0,
      size: 20
    });
    expect(component.cases()).toEqual([caseA, caseB]);
    expect(component.departments()).toEqual(departments);
    expect(component.categories()).toEqual(categories);
    expect(component.isLoading()).toBe(false);
  });

  it('renders only the cases returned by the backend (server-scoped visibility)', () => {
    caseService.searchCases.mockReturnValue(
      of({
        content: [caseA],
        totalElements: 1,
        totalPages: 1,
        page: 0,
        size: 20,
        first: true,
        last: true
      })
    );
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.cases()).toEqual([caseA]);
    expect(component.totalElements()).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('CASE-2026-0001');
    expect(fixture.nativeElement.textContent).not.toContain('CASE-2026-0002');
  });

  it('shows the forbidden message when the case list returns 403', () => {
    caseService.searchCases.mockReturnValue(throwError(() => ({ status: 403 })));
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.listError()).toBe('cases.errors.forbidden');
    expect(component.cases()).toEqual([]);
    expect(component.isLoading()).toBe(false);
  });

  it('shows a generic message when the case list fails without a 403', () => {
    caseService.searchCases.mockReturnValue(throwError(() => ({ status: 500 })));
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.listError()).toBe('cases.errors.loadFailed');
  });

  it('shows the forbidden message when departments return 403', () => {
    caseService.getDepartments.mockReturnValue(throwError(() => ({ status: 403 })));
    component.ngOnInit();

    expect(component.lookupError()).toBe('cases.errors.forbidden');
  });

  it('shows a generic message when departments fail without a 403', () => {
    caseService.getDepartments.mockReturnValue(throwError(() => ({ status: 500 })));
    component.ngOnInit();

    expect(component.lookupError()).toBe('cases.errors.loadDepartmentsFailed');
  });

  it('shows the forbidden message when categories return 403', () => {
    caseService.getCategories.mockReturnValue(throwError(() => ({ status: 403 })));
    component.ngOnInit();

    expect(component.lookupError()).toBe('cases.errors.forbidden');
  });

  it('shows a generic message when categories fail without a 403', () => {
    caseService.getCategories.mockReturnValue(throwError(() => ({ status: 500 })));
    component.ngOnInit();

    expect(component.lookupError()).toBe('cases.errors.loadCategoriesFailed');
  });

  it('reloads with filter params when search values change', () => {
    vi.useFakeTimers();
    component.searchForm.patchValue({ keyword: 'tap', status: 'NEW', type: 'REQUEST', priority: 'HIGH' });
    vi.advanceTimersByTime(500);
    vi.useRealTimers();

    expect(lastSearchArgs()).toEqual({
      page: 0,
      size: 20,
      keyword: 'tap',
      status: 'NEW',
      type: 'REQUEST',
      priority: 'HIGH'
    });
  });

  it('omits empty filters from the search request', () => {
    vi.useFakeTimers();
    component.searchForm.patchValue({ keyword: 'tap', status: '', type: '', priority: '' });
    vi.advanceTimersByTime(500);
    vi.useRealTimers();

    expect(lastSearchArgs()).toEqual({
      page: 0,
      size: 20,
      keyword: 'tap'
    });
  });

  it('does not reload when search values are unchanged (L-17)', () => {
    vi.useFakeTimers();
    const values = {
      keyword: 'tap',
      status: 'NEW' as 'NEW',
      type: 'REQUEST' as 'REQUEST',
      priority: 'HIGH' as 'HIGH'
    };
    component.searchForm.patchValue(values);
    vi.advanceTimersByTime(500);

    const callsAfterChange = caseService.searchCases.mock.calls.length;
    expect(callsAfterChange).toBeGreaterThan(0);

    component.searchForm.patchValue(values);
    vi.advanceTimersByTime(500);
    vi.useRealTimers();

    expect(caseService.searchCases.mock.calls).toHaveLength(callsAfterChange);
  });

  it('goToPage reloads with the requested page number', () => {
    component.totalPages.set(5);
    component.goToPage(2);
    expect(lastSearchArgs()).toEqual({ page: 2, size: 20 });
  });

  it('ignores page requests beyond the total page count', () => {
    component.totalPages.set(2);
    const before = caseService.searchCases.mock.calls.length;
    component.goToPage(5);
    expect(caseService.searchCases.mock.calls).toHaveLength(before);
  });

  it('clearFilters resets the form and reloads', () => {
    vi.useFakeTimers();
    component.searchForm.patchValue({ keyword: 'tap', status: 'NEW', type: 'REQUEST', priority: 'HIGH' });
    vi.advanceTimersByTime(500);
    vi.useRealTimers();

    const before = caseService.searchCases.mock.calls.length;

    vi.useFakeTimers();
    component.clearFilters();
    vi.advanceTimersByTime(500);
    vi.useRealTimers();

    expect(component.searchForm.value).toEqual({ keyword: '', status: '', type: '', priority: '' });
    expect(component.currentPage()).toBe(0);
    expect(caseService.searchCases.mock.calls.length).toBeGreaterThan(before);
  });

  it('openCaseDetail navigates to the case detail route', () => {
    component.openCaseDetail('case-a');
    expect(router.navigate).toHaveBeenCalledWith(['/cases', 'case-a']);
  });

  it('activates the create tab when the tab=create query param arrives (M-27)', () => {
    queryParams$.next({ tab: 'create' });

    expect(component.activeTab()).toBe('create');
  });

  it('stays on the list tab when the query params carry no tab (M-27)', () => {
    queryParams$.next({});

    expect(component.activeTab()).toBe('list');
  });

  it('pre-fills the citizen national id from the navigation state (M-27)', () => {
    router.currentNavigation.set({
      extras: { state: { citizenNationalId: '1234567890123456' } }
    });
    component.ngOnInit();

    expect(component.createForm.get('citizenNationalId')?.value).toBe('1234567890123456');
  });

  it('does not pre-fill the national id when no navigation state is present (M-27)', () => {
    router.currentNavigation.set(null);
    component.ngOnInit();

    expect(component.createForm.get('citizenNationalId')?.value).toBe('');
  });

  // ── US-53: Bulk reassign ──────────────────────────────────────────

  describe('US-53: Bulk reassign', () => {

    it('isSupervisor calls authUserService.hasRole', () => {
      // The computed signal is cached at creation; verify the mock was used
      expect(authUserService.hasRole).toHaveBeenCalled();
    });

    it('toggleSelect adds a case id to selectedCaseIds', () => {
      const event = { stopPropagation: vi.fn() } as unknown as Event;
      component.toggleSelect('case-a', event);
      expect(component.selectedCaseIds().has('case-a')).toBe(true);
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('toggleSelect removes a case id when already selected', () => {
      component.selectedCaseIds.set(new Set(['case-a']));
      const event = { stopPropagation: vi.fn() } as unknown as Event;
      component.toggleSelect('case-a', event);
      expect(component.selectedCaseIds().has('case-a')).toBe(false);
    });

    it('toggleSelectAll selects all cases when none selected', () => {
      component.toggleSelectAll();
      expect(component.selectedCaseIds()).toEqual(new Set(['case-a', 'case-b']));
    });

    it('toggleSelectAll deselects all when all already selected', () => {
      component.selectedCaseIds.set(new Set(['case-a', 'case-b']));
      component.toggleSelectAll();
      expect(component.selectedCaseIds().size).toBe(0);
    });

    it('allSelected is true when every case is selected', () => {
      component.selectedCaseIds.set(new Set(['case-a', 'case-b']));
      expect(component.allSelected()).toBe(true);
    });

    it('hasSelection is true when at least one case is selected', () => {
      component.selectedCaseIds.set(new Set(['case-a']));
      expect(component.hasSelection()).toBe(true);
    });

    it('selectedCount reflects the number of selected cases', () => {
      component.selectedCaseIds.set(new Set(['case-a', 'case-b']));
      expect(component.selectedCount()).toBe(2);
    });

    it('openReassignModal opens the modal and loads handlers', () => {
      component.selectedCaseIds.set(new Set(['case-a']));
      component.openReassignModal();
      expect(component.isReassignModalOpen()).toBe(true);
      expect(caseService.getHandlers).toHaveBeenCalled();
    });

    it('openReassignModal does nothing when no cases selected', () => {
      component.selectedCaseIds.set(new Set());
      component.openReassignModal();
      expect(component.isReassignModalOpen()).toBe(false);
    });

    it('closeReassignModal closes the modal and resets state', () => {
      component.isReassignModalOpen.set(true);
      component.closeReassignModal();
      expect(component.isReassignModalOpen()).toBe(false);
      expect(component.bulkReassignError()).toBeNull();
      expect(component.bulkReassignResult()).toBeNull();
    });

    it('submitBulkReassign calls service and updates result on success', () => {
      const result = {
        totalRequested: 2,
        succeeded: 2,
        failed: 0,
        results: []
      };
      caseService.bulkReassignCases.mockReturnValue(of(result));

      component.selectedCaseIds.set(new Set(['case-a', 'case-b']));
      component.reassignHandlerId.set('handler-1');
      component.reassignComment.set('Balancing workload');
      component.submitBulkReassign();

      expect(caseService.bulkReassignCases).toHaveBeenCalledWith({
        caseIds: ['case-a', 'case-b'],
        assignedToUserId: 'handler-1',
        comment: 'Balancing workload'
      });
      expect(component.bulkReassignResult()).toEqual(result);
      expect(component.bulkReassignLoading()).toBe(false);
    });

    it('submitBulkReassign sets error when handler not selected', () => {
      component.reassignHandlerId.set('');
      component.submitBulkReassign();
      expect(component.bulkReassignError()).toBe('cases.bulkReassign.handlerRequired');
      expect(caseService.bulkReassignCases).not.toHaveBeenCalled();
    });

    it('submitBulkReassign handles partial failure', () => {
      const result = {
        totalRequested: 2,
        succeeded: 1,
        failed: 1,
        results: [
          { caseId: 'case-a', caseNumber: 'CASE-2026-0001', success: true, errorCode: null, message: null },
          { caseId: 'case-b', caseNumber: 'CASE-2026-0002', success: false, errorCode: 'ALREADY_ASSIGNED', message: 'Already assigned' }
        ]
      };
      caseService.bulkReassignCases.mockReturnValue(of(result));

      component.selectedCaseIds.set(new Set(['case-a', 'case-b']));
      component.reassignHandlerId.set('handler-1');
      component.reassignComment.set('Balancing workload');
      component.submitBulkReassign();

      expect(component.bulkReassignResult()?.failed).toBe(1);
      // selectedCaseIds should NOT be cleared on partial failure
      expect(component.selectedCaseIds().size).toBe(2);
    });

    it('submitBulkReassign clears selection on full success', () => {
      const result = {
        totalRequested: 2,
        succeeded: 2,
        failed: 0,
        results: []
      };
      caseService.bulkReassignCases.mockReturnValue(of(result));

      component.selectedCaseIds.set(new Set(['case-a', 'case-b']));
      component.reassignHandlerId.set('handler-1');
      component.reassignComment.set('Balancing workload');
      component.submitBulkReassign();

      expect(component.selectedCaseIds().size).toBe(0);
    });

    it('submitBulkReassign handles HTTP error', () => {
      caseService.bulkReassignCases.mockReturnValue(throwError(() => ({ status: 500 })));

      component.selectedCaseIds.set(new Set(['case-a']));
      component.reassignHandlerId.set('handler-1');
      component.reassignComment.set('Balancing workload');
      component.submitBulkReassign();

      expect(component.bulkReassignError()).toBe('cases.bulkReassign.loadFailed');
      expect(component.bulkReassignLoading()).toBe(false);
    });

    it('submitBulkReassign handles 403 error', () => {
      caseService.bulkReassignCases.mockReturnValue(throwError(() => ({ status: 403 })));

      component.selectedCaseIds.set(new Set(['case-a']));
      component.reassignHandlerId.set('handler-1');
      component.reassignComment.set('Balancing workload');
      component.submitBulkReassign();

      expect(component.bulkReassignError()).toBe('cases.errors.forbidden');
    });

    it('submitBulkReassign sets error when comment is blank (AUD-01)', () => {
      caseService.bulkReassignCases.mockReturnValue(of({ totalRequested: 1, succeeded: 0, failed: 0, results: [] }));

      component.selectedCaseIds.set(new Set(['case-a']));
      component.reassignHandlerId.set('handler-1');
      component.reassignComment.set('   ');
      component.submitBulkReassign();

      expect(component.bulkReassignError()).toBe('cases.bulkReassign.commentRequired');
      expect(caseService.bulkReassignCases).not.toHaveBeenCalled();
    });

    it('reassignCommentFilled is false for blank/whitespace comment', () => {
      component.reassignComment.set('');
      expect(component.reassignCommentFilled()).toBe(false);
      component.reassignComment.set('   ');
      expect(component.reassignCommentFilled()).toBe(false);
      component.reassignComment.set('reason');
      expect(component.reassignCommentFilled()).toBe(true);
    });

    it('bulkReassignFailures lists only failed cases (no silent skips)', () => {
      component.bulkReassignResult.set({
        totalRequested: 3,
        succeeded: 1,
        failed: 2,
        results: [
          { caseId: 'case-a', caseNumber: 'CASE-2026-0001', success: true, errorCode: null, message: null },
          { caseId: 'case-b', caseNumber: 'CASE-2026-0002', success: false, errorCode: 'INVALID_TRANSITION', message: 'Closed' },
          { caseId: 'case-c', caseNumber: 'CASE-2026-0003', success: false, errorCode: 'NOT_FOUND', message: 'Missing' }
        ]
      });

      const failures = component.bulkReassignFailures();
      expect(failures).toHaveLength(2);
      expect(failures.map(f => f.caseNumber)).toEqual(['CASE-2026-0002', 'CASE-2026-0003']);
    });

    it('bulkReassignFailures is empty when there is no result', () => {
      component.bulkReassignResult.set(null);
      expect(component.bulkReassignFailures()).toEqual([]);
    });

    it('isReassignable is true only for ASSIGNED / IN_PROGRESS / AWAITING_INFO / SUSPENDED', () => {
      expect(component.isReassignable('ASSIGNED')).toBe(true);
      expect(component.isReassignable('IN_PROGRESS')).toBe(true);
      expect(component.isReassignable('AWAITING_INFO')).toBe(true);
      expect(component.isReassignable('SUSPENDED')).toBe(true);
      expect(component.isReassignable('NEW')).toBe(false);
      expect(component.isReassignable('RESOLVED')).toBe(false);
      expect(component.isReassignable('CLOSED')).toBe(false);
      expect(component.isReassignable('CANCELLED')).toBe(false);
    });

    it('toggleSelect ignores a case whose status is ineligible', () => {
      component.cases.set([{ ...caseA, status: 'CLOSED' }]);
      const event = { stopPropagation: vi.fn() } as unknown as Event;
      component.toggleSelect('case-a', event);
      expect(component.selectedCaseIds().size).toBe(0);
    });

    it('toggleSelectAll selects only the reassignable rows on the page', () => {
      component.cases.set([caseA, { ...caseA, id: 'case-c', caseNumber: 'CASE-2026-0003', status: 'CLOSED' }]);
      component.toggleSelectAll();
      expect(component.selectedCaseIds()).toEqual(new Set(['case-a']));
    });

    it('allSelected is false when the page has only ineligible cases', () => {
      component.cases.set([{ ...caseA, status: 'CLOSED' }]);
      component.selectedCaseIds.set(new Set());
      expect(component.allSelected()).toBe(false);
    });

    it('onHandlerSearch updates handlerSearchTerm', () => {
      component.onHandlerSearch('john');
      expect(component.handlerSearchTerm()).toBe('john');
    });

    it('selectHandler sets reassignHandlerId', () => {
      component.selectHandler('handler-1');
      expect(component.reassignHandlerId()).toBe('handler-1');
    });
  });

  // ── US-54: Workload quick filters on the case list ───────────────

  describe('US-54: Workload quick filters', () => {

    it('toggleQuickFilter("overdue") enables the filter and reloads with overdue=true', () => {
      component.toggleQuickFilter('overdue');

      expect(component.quickFilters()).toEqual({ overdue: true, dueToday: false, unassigned: false });
      const args = lastSearchArgs();
      expect(args.overdue).toBe(true);
      expect(args.dueToday).toBeUndefined();
      expect(args.unassigned).toBeUndefined();
    });

    it('toggleQuickFilter sends all three params when all active', () => {
      component.toggleQuickFilter('overdue');
      component.toggleQuickFilter('dueToday');
      component.toggleQuickFilter('unassigned');

      const args = lastSearchArgs();
      expect(args.overdue).toBe(true);
      expect(args.dueToday).toBe(true);
      expect(args.unassigned).toBe(true);
    });

    it('toggleQuickFilter disables the filter on second toggle and omits the param', () => {
      component.toggleQuickFilter('overdue');
      component.toggleQuickFilter('overdue');

      expect(component.quickFilters()).toEqual({ overdue: false, dueToday: false, unassigned: false });
      expect(lastSearchArgs().overdue).toBeUndefined();
    });

    it('toggleQuickFilter syncs the active filter into the URL query params', () => {
      component.toggleQuickFilter('dueToday');

      expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
        queryParams: { dueToday: 'true' }
      }));
    });

    it('toggleQuickFilter removes a param from the URL when turned off', () => {
      // Seed the route with two active filters, then turn one off.
      routeSnapshot.queryParams = { overdue: 'true', dueToday: 'true' };
      component.quickFilters.set({ overdue: true, dueToday: true, unassigned: false });

      component.toggleQuickFilter('dueToday');

      expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
        queryParams: { overdue: 'true' }
      }));
    });

    it('applies quick filters carried in the URL on a later navigation (deep link)', () => {
      component.applyUrlQuickFilters({ overdue: 'true' }, false);

      expect(component.quickFilters()).toEqual({ overdue: true, dueToday: false, unassigned: false });
      expect(lastSearchArgs().overdue).toBe(true);
    });

    it('does not reload when the URL quick filters are unchanged', () => {
      const before = caseService.searchCases.mock.calls.length;
      // Signals already all-false; applying an empty param set is a no-op.
      component.applyUrlQuickFilters({}, false);
      expect(caseService.searchCases.mock.calls.length).toBe(before);
    });

    it('clearFilters clears active quick filters and reloads', () => {
      component.toggleQuickFilter('overdue');
      const before = caseService.searchCases.mock.calls.length;

      component.clearFilters();

      expect(component.quickFilters()).toEqual({ overdue: false, dueToday: false, unassigned: false });
      expect(caseService.searchCases.mock.calls.length).toBeGreaterThan(before);
    });
  });

  // ── US-57: create case from Citizen 360 ─────────────────────────

  function paramFromCitizen360(): void {
    queryParams$.next({ tab: 'create', citizenId: 'cit-360' });
  }

  function fillCreateForm(extra: Record<string, string> = {}): void {
    // departmentId must be patched BEFORE categoryId: the component resets
    // categoryId whenever departmentId changes (existing behaviour).
    component.createForm.patchValue({
      subject: 'Water leak',
      description: 'Leak on the main road',
      type: 'COMPLAINT',
      priority: 'HIGH',
      channel: 'PHONE',
      departmentId: 'dep-1',
      categoryId: 'cat-1',
      ...extra
    });
  }

  it('locks the citizen from the citizenId query param (US-57)', () => {
    paramFromCitizen360();

    expect(citizenService.getCitizenById).toHaveBeenCalledWith('cit-360');
    expect(component.linkedCitizen()).toEqual({
      id: 'cit-360',
      name: 'Jane Citizen',
      nationalId: '1234567890123456'
    });
    expect(component.linkedCitizenLoading()).toBe(false);
    // The free-typed field must NOT be prefilled — the citizen is bound by id.
    expect(component.createForm.get('citizenNationalId')?.value).toBe('');
  });

  it('does not re-fetch the linked citizen on repeated param emissions (US-57)', () => {
    paramFromCitizen360();
    paramFromCitizen360();

    expect(citizenService.getCitizenById).toHaveBeenCalledTimes(1);
  });

  it('keeps the national id optional while the citizen is locked (US-57)', () => {
    paramFromCitizen360();
    fillCreateForm();

    expect(component.createForm.valid).toBe(true);
    expect(component.createForm.get('citizenNationalId')?.errors).toBeNull();
  });

  it('submits via the citizen-scoped endpoint and opens the new case (US-57)', () => {
    paramFromCitizen360();
    fillCreateForm();
    caseService.createCaseForCitizen.mockReturnValue(of(caseA));

    component.onSubmit();

    expect(caseService.createCaseForCitizen).toHaveBeenCalledWith('cit-360', {
      subject: 'Water leak',
      description: 'Leak on the main road',
      type: 'COMPLAINT',
      priority: 'HIGH',
      channel: 'PHONE',
      categoryId: 'cat-1',
      departmentId: 'dep-1'
    });
    // No citizenNationalId leaks into the payload.
    expect(caseService.createCaseForCitizen.mock.calls[0][1]).not.toHaveProperty('citizenNationalId');
    expect(caseService.createCase).not.toHaveBeenCalled();
    // Success lands on the case-detail page showing the generated case id.
    expect(router.navigate).toHaveBeenCalledWith(['/cases', 'case-a']);
  });

  it('changeCitizen releases the lock and restores the required field (US-57)', () => {
    paramFromCitizen360();
    expect(component.linkedCitizen()).not.toBeNull();

    component.changeCitizen();

    expect(component.linkedCitizen()).toBeNull();
    fillCreateForm();
    expect(component.createForm.get('citizenNationalId')?.errors?.['required']).toBeTruthy();
    expect(component.createForm.valid).toBe(false);
  });

  it('changeCitizen allows a free-typed national id submission (US-57)', () => {
    paramFromCitizen360();
    component.changeCitizen();
    fillCreateForm({ citizenNationalId: '1234567890123456' });
    caseService.createCase.mockReturnValue(of(caseA));

    component.onSubmit();

    expect(caseService.createCase).toHaveBeenCalledWith(expect.objectContaining({
      citizenNationalId: '1234567890123456'
    }));
    expect(caseService.createCaseForCitizen).not.toHaveBeenCalled();
  });

  it('cancelCreate returns to the same Citizen 360 profile (US-57)', () => {
    paramFromCitizen360();

    component.cancelCreate();

    expect(router.navigate).toHaveBeenCalledWith(['/app/call-center/citizen', 'cit-360']);
  });

  it('cancelCreate falls back to the list tab when no citizen is linked', () => {
    router.currentNavigation.set(null);
    component.ngOnInit();
    component.activeTab.set('create');

    component.cancelCreate();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.activeTab()).toBe('list');
  });

  it('submits via the generic endpoint when no citizen is linked (US-57 regression guard)', () => {
    router.currentNavigation.set(null);
    component.ngOnInit();
    fillCreateForm({ citizenNationalId: '1234567890123456' });
    caseService.createCase.mockReturnValue(of(caseA));

    component.onSubmit();

    expect(caseService.createCase).toHaveBeenCalledWith(expect.objectContaining({
      citizenNationalId: '1234567890123456'
    }));
    expect(caseService.createCaseForCitizen).not.toHaveBeenCalled();
    // Legacy behaviour preserved: banner + back to list, no navigation.
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.submitSuccess()).toBe(true);
  });

  // ── US-58: possible-duplicate open-case warning ─────────────────

  const openCandidate = {
    id: 'dup-1',
    caseNumber: 'CASE-2026-0100',
    subject: 'Same leak',
    status: 'IN_PROGRESS' as CaseStatus,
    createdAt: '2026-01-05T08:00:00Z'
  };

  it('runs the preflight before the first linked submission and warns on open candidates (US-58)', () => {
    paramFromCitizen360();
    fillCreateForm();
    caseService.checkDuplicateCases.mockReturnValue(of([openCandidate]));
    caseService.createCaseForCitizen.mockReturnValue(of(caseA));

    component.onSubmit();

    // Preflight targets the locked citizen + the selected category/department.
    expect(caseService.checkDuplicateCases).toHaveBeenCalledWith('cit-360', 'cat-1', 'dep-1');
    // Blocked: no create happened, no spinner is left on, warning is visible.
    expect(caseService.createCaseForCitizen).not.toHaveBeenCalled();
    expect(caseService.createCase).not.toHaveBeenCalled();
    expect(component.duplicateWarning()).toBe(true);
    expect(component.duplicateCandidates()).toEqual([openCandidate]);
    expect(component.isSubmitting()).toBe(false);
  });

  it('does not call the duplicate preflight for the generic (unlinked) flow (US-58)', () => {
    router.currentNavigation.set(null);
    component.ngOnInit();
    component.activeTab.set('create');
    fillCreateForm({ citizenNationalId: '1234567890123456' });
    caseService.createCase.mockReturnValue(of(caseA));

    component.onSubmit();

    expect(caseService.checkDuplicateCases).not.toHaveBeenCalled();
    expect(caseService.createCase).toHaveBeenCalled();
  });

  it('blocks until the agent confirms a non-blank reason, then sends it (US-58)', () => {
    paramFromCitizen360();
    fillCreateForm();
    caseService.checkDuplicateCases.mockReturnValue(of([openCandidate]));
    caseService.createCaseForCitizen.mockReturnValue(of(caseA));

    component.onSubmit();
    expect(component.duplicateWarning()).toBe(true);

    // Blank reason -> still blocked + validation hint.
    component.continueWithDuplicate();
    expect(component.duplicateReasonInvalid()).toBe(true);
    expect(caseService.createCaseForCitizen).not.toHaveBeenCalled();

    // Confirmed reason -> create with the reason attached.
    component.createForm.patchValue({ duplicateReason: 'Citizen insists' });
    component.continueWithDuplicate();

    expect(caseService.createCaseForCitizen).toHaveBeenCalledWith('cit-360', expect.objectContaining({
      subject: 'Water leak',
      duplicateReason: 'Citizen insists'
    }));
    expect(router.navigate).toHaveBeenCalledWith(['/cases', 'case-a']);
  });

  it('submits directly when the preflight finds no open candidates (US-58)', () => {
    paramFromCitizen360();
    fillCreateForm();
    caseService.checkDuplicateCases.mockReturnValue(of([]));
    caseService.createCaseForCitizen.mockReturnValue(of(caseA));

    component.onSubmit();

    expect(component.duplicateWarning()).toBe(false);
    expect(caseService.createCaseForCitizen).toHaveBeenCalledWith('cit-360', expect.objectContaining({
      subject: 'Water leak',
      categoryId: 'cat-1',
      departmentId: 'dep-1'
    }));
    // No reason is sent when there was nothing to override.
    expect(caseService.createCaseForCitizen.mock.calls[0][1]).not.toHaveProperty('duplicateReason');
    expect(router.navigate).toHaveBeenCalledWith(['/cases', 'case-a']);
  });

  it('proceeds without blocking when the preflight request fails (advisory only, US-58)', () => {
    paramFromCitizen360();
    fillCreateForm();
    caseService.checkDuplicateCases.mockReturnValue(throwError(() => ({ status: 500 })));
    caseService.createCaseForCitizen.mockReturnValue(of(caseA));

    component.onSubmit();

    expect(component.duplicateCheckFailed()).toBe(true);
    expect(component.duplicateWarning()).toBe(false);
    expect(caseService.createCaseForCitizen).toHaveBeenCalled();
  });

  it('runs the live pre-check debounced once category/department are chosen (US-58)', () => {
    vi.useFakeTimers();
    try {
      paramFromCitizen360();
      fillCreateForm();
      caseService.checkDuplicateCases.mockReturnValue(of([openCandidate]));

      // Before the debounce elapses no request has been issued.
      expect(caseService.checkDuplicateCases).not.toHaveBeenCalled();

      vi.advanceTimersByTime(600);

      expect(caseService.checkDuplicateCases).toHaveBeenCalledWith('cit-360', 'cat-1', 'dep-1');
      expect(component.duplicateWarning()).toBe(true);

      // Submitting now is blocked by the already-visible warning.
      component.onSubmit();
      expect(caseService.createCaseForCitizen).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('invalidates stale results and re-checks when the inputs change (US-58)', () => {
    vi.useFakeTimers();
    try {
      paramFromCitizen360();
      fillCreateForm();
      caseService.checkDuplicateCases.mockReturnValue(of([]));
      caseService.createCaseForCitizen.mockReturnValue(of(caseA));

      component.onSubmit();
      expect(component.duplicateWarning()).toBe(false);

      // Rapid category changes invalidate the old result and coalesce into a
      // single fresh check for the last-selected category.
      component.createForm.patchValue({ categoryId: 'cat-2' });
      component.createForm.patchValue({ categoryId: 'cat-3' });
      vi.advanceTimersByTime(600);

      expect(caseService.checkDuplicateCases).toHaveBeenLastCalledWith('cit-360', 'cat-3', 'dep-1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('changeCitizen clears the duplicate warning state (US-58)', () => {
    paramFromCitizen360();
    fillCreateForm();
    caseService.checkDuplicateCases.mockReturnValue(of([openCandidate]));
    component.onSubmit();
    expect(component.duplicateWarning()).toBe(true);

    component.changeCitizen();

    expect(component.duplicateWarning()).toBe(false);
    expect(component.duplicateCandidates()).toEqual([]);
    expect(component.duplicateOverride()).toBe(false);
  });

  it('renders the warning panel with the candidate case number and subject (US-58)', () => {
    paramFromCitizen360();
    fillCreateForm();
    caseService.checkDuplicateCases.mockReturnValue(of([openCandidate]));
    caseService.createCaseForCitizen.mockReturnValue(of(caseA));

    component.onSubmit();
    component.createForm.patchValue({ duplicateReason: 'Duplicate of an urgent request' });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('CASE-2026-0100');
    expect(text).toContain('Same leak');
  });
});
