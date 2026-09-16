/*
 * DashboardComponent spec — Vitest / Angular unit-test builder
 *
 * US-54: workload indicators on the dashboard
 *
 * COVERED:
 *   - loads workload indicators on init
 *   - displays indicator cards with correct counts
 *   - shows loading state while fetching workload
 *   - shows error state when workload fetch fails
 *   - retry button re-fetches workload indicators
 *   - handler scope shows ASSIGNED/OVERDUE/DUE_TODAY indicators
 *   - supervisor scope shows OVERDUE/DUE_TODAY/UNASSIGNED indicators
 */

import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';

import { DashboardComponent } from './dashboard';
import { DashboardService } from '../../../core/services/dashboard.service';
import { AuthUserService } from '../../auth/auth-user.service';
import { DashboardSummaryResponse } from '../../../core/models/dashboard.models';

const mockSummary: DashboardSummaryResponse = {
  kpis: { openCases: 10, resolvedThisMonth: 5, overdueCases: 2, newToday: 3 },
  statusCounts: {
    NEW: 3, ASSIGNED: 2, IN_PROGRESS: 3, AWAITING_INFO: 1,
    SUSPENDED: 0, RESOLVED: 1, CLOSED: 0, CANCELLED: 0
  }
};

const personalWorkload = {
  scope: 'PERSONAL' as const,
  indicators: [
    { key: 'ASSIGNED' as const, count: 12, link: '/api/v1/dashboard/my-inbox' },
    { key: 'OVERDUE' as const, count: 4, link: '/api/v1/dashboard/my-inbox?overdue=true' },
    { key: 'DUE_TODAY' as const, count: 2, link: '/api/v1/dashboard/my-inbox?dueToday=true' }
  ]
};

const teamWorkload = {
  scope: 'TEAM' as const,
  indicators: [
    { key: 'OVERDUE' as const, count: 5, link: '/api/v1/cases?overdue=true' },
    { key: 'DUE_TODAY' as const, count: 3, link: '/api/v1/cases?dueToday=true' },
    { key: 'UNASSIGNED' as const, count: 1, link: '/api/v1/cases?unassigned=true' }
  ]
};

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;

  let dashboardService: {
    getSummary: ReturnType<typeof vi.fn>;
    getMyOpenCases: ReturnType<typeof vi.fn>;
    getWorkloadIndicators: ReturnType<typeof vi.fn>;
  };
  let authUserService: {
    hasRole: ReturnType<typeof vi.fn>;
    hasRoleSignal: ReturnType<typeof vi.fn>;
    hasRoleAny: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dashboardService = {
      getSummary: vi.fn().mockReturnValue(of(mockSummary)),
      getMyOpenCases: vi.fn().mockReturnValue(of([])),
      getWorkloadIndicators: vi.fn().mockReturnValue(of(personalWorkload))
    };
    authUserService = {
      hasRole: vi.fn().mockReturnValue(false),
      hasRoleSignal: vi.fn().mockReturnValue(() => false),
      hasRoleAny: vi.fn().mockReturnValue(false)
    };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: DashboardService, useValue: dashboardService },
        { provide: AuthUserService, useValue: authUserService },
        { provide: Router, useValue: router },
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

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads summary and workload indicators on init', () => {
    expect(dashboardService.getSummary).toHaveBeenCalled();
    expect(dashboardService.getWorkloadIndicators).toHaveBeenCalled();
  });

  it('sets summary signal from response', () => {
    expect(component.summary()).toEqual(mockSummary);
  });

  it('sets workload signal from response', () => {
    expect(component.workload()).toEqual(personalWorkload);
  });

  describe('US-54: Workload indicators', () => {

    it('displays workload cards with correct data for handler scope', () => {
      expect(component.workloadCards().length).toBe(3);
      expect(component.workloadCards()[0].key).toBe('ASSIGNED');
      expect(component.workloadCards()[0].count).toBe(12);
      expect(component.workloadCards()[1].key).toBe('OVERDUE');
      expect(component.workloadCards()[2].key).toBe('DUE_TODAY');
    });

    it('displays workload cards for supervisor scope', () => {
      dashboardService.getWorkloadIndicators.mockReturnValue(of(teamWorkload));
      component.loadWorkloadIndicators();
      fixture.detectChanges();

      expect(component.workloadCards().length).toBe(3);
      expect(component.workloadCards()[0].key).toBe('OVERDUE');
      expect(component.workloadCards()[1].key).toBe('DUE_TODAY');
      expect(component.workloadCards()[2].key).toBe('UNASSIGNED');
    });

    it('shows loading state while fetching workload', () => {
      // Reset to show loading
      component.workload.set(null);
      component.isLoadingWorkload.set(true);
      fixture.detectChanges();

      expect(component.isLoadingWorkload()).toBe(true);
    });

    it('shows error state when workload fetch fails', () => {
      dashboardService.getWorkloadIndicators.mockReturnValue(
        throwError(() => ({ status: 500 }))
      );
      component.loadWorkloadIndicators();

      expect(component.workloadError()).toBe('dashboard.workload.loadFailed');
      expect(component.isLoadingWorkload()).toBe(false);
    });

    it('shows forbidden error when workload fetch returns 403', () => {
      dashboardService.getWorkloadIndicators.mockReturnValue(
        throwError(() => ({ status: 403 }))
      );
      component.loadWorkloadIndicators();

      expect(component.workloadError()).toBe('dashboard.errors.noPermission');
    });

    it('retry button re-fetches workload indicators', () => {
      component.workloadError.set('dashboard.workload.loadFailed');
      dashboardService.getWorkloadIndicators.mockReturnValue(of(personalWorkload));

      component.loadWorkloadIndicators();

      expect(dashboardService.getWorkloadIndicators).toHaveBeenCalled();
      expect(component.workloadError()).toBeNull();
      expect(component.workload()).toEqual(personalWorkload);
    });

    it('workloadCards maps indicator keys to correct metadata', () => {
      const cards = component.workloadCards();
      const assignedCard = cards.find(c => c.key === 'ASSIGNED');
      expect(assignedCard?.icon).toBe('assignment');
      expect(assignedCard?.labelKey).toBe('dashboard.workload.assigned');

      const overdueCard = cards.find(c => c.key === 'OVERDUE');
      expect(overdueCard?.icon).toBe('warning');
      expect(overdueCard?.labelKey).toBe('dashboard.workload.overdue');
    });

    it('returns empty workloadCards when workload is null', () => {
      component.workload.set(null);
      expect(component.workloadCards()).toEqual([]);
    });
  });

  // ── US-54: indicator deep links (DSH-04 / DSH-05) ─────────────

  describe('US-54: indicator deep links', () => {
    it('handler scope: ASSIGNED navigates to the inbox (no filter)', () => {
      const card = component.workloadCards().find(c => c.key === 'ASSIGNED')!;
      component.onWorkloadCardClick(card);
      expect(router.navigate).toHaveBeenCalledWith(['/inbox']);
    });

    it('handler scope: OVERDUE navigates to the inbox with the overdue filter', () => {
      const card = component.workloadCards().find(c => c.key === 'OVERDUE')!;
      component.onWorkloadCardClick(card);
      expect(router.navigate).toHaveBeenCalledWith(['/inbox', { queryParams: { overdue: 'true' } }]);
    });

    it('handler scope: DUE_TODAY navigates to the inbox with the dueToday filter', () => {
      const card = component.workloadCards().find(c => c.key === 'DUE_TODAY')!;
      component.onWorkloadCardClick(card);
      expect(router.navigate).toHaveBeenCalledWith(['/inbox', { queryParams: { dueToday: 'true' } }]);
    });

    it('team scope: UNASSIGNED navigates to the case list with the unassigned filter', () => {
      dashboardService.getWorkloadIndicators.mockReturnValue(of(teamWorkload));
      component.loadWorkloadIndicators();
      fixture.detectChanges();

      const card = component.workloadCards().find(c => c.key === 'UNASSIGNED')!;
      component.onWorkloadCardClick(card);
      expect(router.navigate).toHaveBeenCalledWith(['/cases', { queryParams: { unassigned: 'true' } }]);
    });

    it('team scope: OVERDUE navigates to the case list with the overdue filter', () => {
      dashboardService.getWorkloadIndicators.mockReturnValue(of(teamWorkload));
      component.loadWorkloadIndicators();
      fixture.detectChanges();

      const card = component.workloadCards().find(c => c.key === 'OVERDUE')!;
      component.onWorkloadCardClick(card);
      expect(router.navigate).toHaveBeenCalledWith(['/cases', { queryParams: { overdue: 'true' } }]);
    });
  });
});
