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
 *
 * SKIPPED (with reason):
 *   - Client-side role filtering of the case list: the backend only returns
 *     cases visible to the current role, so the frontend has no client-side
 *     role filter to unit test.
 *   - Create-case form flows: covered separately (not access-control related).
 */

import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';

import { CasesComponent } from './cases';
import { CaseService } from '../../../core/services/case.service';
import { LoggerService } from '../../../core/services/logger.service';
import { CaseResponse, CaseStatus } from '../../../core/models/case.models';
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
  closedAt: null
};

const caseB: CaseResponse = { ...caseA, id: 'case-b', caseNumber: 'CASE-2026-0002' };

const departments: Department[] = [{ id: 'dep-1', code: 'DEP1', nameEn: 'Utilities', nameAr: 'مرافق', active: true }];
const categories: Category[] = [{ id: 'cat-1', code: 'CAT1', nameEn: 'Water', nameAr: 'مياه', active: true }];

describe('CasesComponent', () => {
  let fixture: ComponentFixture<CasesComponent>;
  let component: CasesComponent;

  let caseService: {
    searchCases: ReturnType<typeof vi.fn>;
    getDepartments: ReturnType<typeof vi.fn>;
    getCategories: ReturnType<typeof vi.fn>;
    createCase: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn>; getCurrentNavigation: ReturnType<typeof vi.fn> };
  let queryParams$: BehaviorSubject<Record<string, string>>;

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
      createCase: vi.fn()
    };
    router = { navigate: vi.fn(), getCurrentNavigation: vi.fn().mockReturnValue(null) };
    queryParams$ = new BehaviorSubject({});

    await TestBed.configureTestingModule({
      imports: [CasesComponent],
      providers: [
        { provide: CaseService, useValue: caseService },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { queryParams: queryParams$ } },
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

    expect(caseService.searchCases.mock.calls.length).toBe(callsAfterChange);
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
    expect(caseService.searchCases.mock.calls.length).toBe(before);
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
    router.getCurrentNavigation.mockReturnValue({
      extras: { state: { citizenNationalId: '1234567890123456' } }
    });
    component.ngOnInit();

    expect(component.createForm.get('citizenNationalId')?.value).toBe('1234567890123456');
  });

  it('does not pre-fill the national id when no navigation state is present (M-27)', () => {
    router.getCurrentNavigation.mockReturnValue(null);
    component.ngOnInit();

    expect(component.createForm.get('citizenNationalId')?.value).toBe('');
  });
});
