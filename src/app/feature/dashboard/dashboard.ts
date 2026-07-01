import { Component, signal, computed, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DashboardService } from '../../../core/services/dashboard.service';
import { AuthUserService } from '../../auth/auth-user.service';
import {
  DashboardSummaryResponse,
  MyOpenCaseResponse
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

  isLoading      = signal(true);
  loadError      = signal<string | null>(null);
  summary        = signal<DashboardSummaryResponse | null>(null);
  myOpenCases    = signal<MyOpenCaseResponse[]>([]);
  isLoadingCases = signal(false);

  isHandler = computed(() => this.authUserService.hasRole('HANDLER'));

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

  constructor() {
    this.loadSummary();
    if (this.isHandler()) {
      this.loadMyOpenCases();
    }
  }

  private loadSummary(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.dashboardService.getSummary().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.summary.set(res);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('error');
        this.isLoading.set(false);
      }
    });
  }

  private loadMyOpenCases(): void {
    this.isLoadingCases.set(true);
    this.dashboardService.getMyOpenCases().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.myOpenCases.set(res);
        this.isLoadingCases.set(false);
      },
      error: () => {
        this.isLoadingCases.set(false);
      }
    });
  }

  onRowClick(caseId: string): void {
    this.router.navigate(['/cases', caseId]);
  }
}
