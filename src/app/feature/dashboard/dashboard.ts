import { Component, signal, computed, inject, DestroyRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DashboardService } from '../../../core/services/dashboard.service';
import { AuthUserService } from '../../auth/auth-user.service';
import {
  DashboardSummaryResponse,
  MyOpenCaseResponse,
  WorkloadIndicatorsResponse,
  WorkloadIndicator,
  WorkloadIndicatorKey
} from '../../../core/models/dashboard.models';
import { CaseStatus } from '../../../core/models/case.models';
import {
  statusBadgeClass as statusBadge,
  formatDate as fmtDate,
  isOverdue as overdue
} from '../shared/utils/case-display.utils';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent {

  private dashboardService = inject(DashboardService);
  private authUserService  = inject(AuthUserService);
  private router           = inject(Router);
  private transloco        = inject(TranslocoService);
  private destroyRef       = inject(DestroyRef);

  pageTitle = () => this.transloco.translate('dashboard.title');

  isLoading       = signal(true);
  summaryError    = signal<string | null>(null);
  summary         = signal<DashboardSummaryResponse | null>(null);
  myOpenCases     = signal<MyOpenCaseResponse[]>([]);
  isLoadingCases  = signal(false);
  myOpenCasesError = signal<string | null>(null);

  // US-54: workload indicators
  workload          = signal<WorkloadIndicatorsResponse | null>(null);
  isLoadingWorkload = signal(false);
  workloadError     = signal<string | null>(null);

  isHandler = this.authUserService.hasRoleSignal('HANDLER');
  private casesRequested = false;

  statusChartData = computed(() => {
    const s = this.summary();
    if (!s) return [];

    const order: CaseStatus[] = [
      'NEW', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_INFO',
      'SUSPENDED', 'RESOLVED', 'CLOSED', 'CANCELLED'
    ];

    const max = Math.max(...Object.values(s.statusCounts), 1);

    return order.map(status => ({
      status,
      count: s.statusCounts[status] ?? 0,
      percent: Math.round(((s.statusCounts[status] ?? 0) / max) * 100)
    }));
  });

  // Template helpers
  statusBadgeClass = statusBadge;
  formatDate = fmtDate;
  isOverdue = overdue;

  // US-54: metadata for each indicator key (icon, color class, translation key)
  private readonly indicatorMeta: Record<WorkloadIndicatorKey, { icon: string; colorClass: string; labelKey: string }> = {
    ASSIGNED:   { icon: 'assignment',   colorClass: 'bg-primary-fixed text-primary',              labelKey: 'dashboard.workload.assigned' },
    OVERDUE:    { icon: 'warning',      colorClass: 'bg-error-container text-on-error-container', labelKey: 'dashboard.workload.overdue' },
    DUE_TODAY:  { icon: 'today',        colorClass: 'bg-tertiary-fixed text-on-tertiary-fixed-variant', labelKey: 'dashboard.workload.dueToday' },
    UNASSIGNED: { icon: 'person_off',   colorClass: 'bg-surface-container text-on-surface-variant', labelKey: 'dashboard.workload.unassigned' },
  };

  workloadCards = computed(() => {
    const w = this.workload();
    if (!w) return [];
    return w.indicators.map(ind => ({
      ...ind,
      ...this.indicatorMeta[ind.key],
    }));
  });

  constructor() {
    this.loadSummary();
    this.loadWorkloadIndicators();
    effect(() => {
      if (this.isHandler() && !this.casesRequested) {
        this.casesRequested = true;
        this.loadMyOpenCases();
      }
    });
  }

  private loadSummary(): void {
    this.isLoading.set(true);
    this.summaryError.set(null);

    this.dashboardService.getSummary().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.summary.set(res);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.summaryError.set(
          err.status === 403
            ? this.transloco.translate('dashboard.errors.noPermission')
            : this.transloco.translate('dashboard.errors.loadFailed')
        );
      }
    });
  }

  private loadMyOpenCases(): void {
    this.isLoadingCases.set(true);
    this.myOpenCasesError.set(null);
    this.dashboardService.getMyOpenCases().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.myOpenCases.set(res);
        this.isLoadingCases.set(false);
      },
      error: (err) => {
        this.isLoadingCases.set(false);
        this.myOpenCasesError.set(
          err.status === 403
            ? this.transloco.translate('dashboard.myOpenCases.noPermission')
            : this.transloco.translate('dashboard.myOpenCases.loadError')
        );
      }
    });
  }

  // US-54: load role-scoped workload indicators
  loadWorkloadIndicators(): void {
    this.isLoadingWorkload.set(true);
    this.workloadError.set(null);
    this.dashboardService.getWorkloadIndicators().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.workload.set(res);
        this.isLoadingWorkload.set(false);
      },
      error: (err) => {
        this.isLoadingWorkload.set(false);
        this.workloadError.set(
          err.status === 403
            ? this.transloco.translate('dashboard.errors.noPermission')
            : this.transloco.translate('dashboard.workload.loadFailed')
        );
      }
    });
  }

  onRowClick(caseId: string): void {
    this.router.navigate(['/cases', caseId]);
  }

  // US-54 (DSH-04/05): each indicator deep-links to the list with the matching
  // filter applied. PERSONAL scope -> handler inbox; TEAM scope -> case list.
  onWorkloadCardClick(card: { key: WorkloadIndicatorKey }): void {
    const scope = this.workload()?.scope;
    if (scope === 'TEAM') {
      const param =
        card.key === 'OVERDUE'    ? 'overdue'
        : card.key === 'DUE_TODAY' ? 'dueToday'
        :                            'unassigned';
      this.router.navigate(['/cases', { queryParams: { [param]: 'true' } }]);
    } else {
      const param =
        card.key === 'OVERDUE'   ? 'overdue'
        : card.key === 'DUE_TODAY' ? 'dueToday'
        :                            null;
      this.router.navigate(
        param ? ['/inbox', { queryParams: { [param]: 'true' } }] : ['/inbox']
      );
    }
  }
}
