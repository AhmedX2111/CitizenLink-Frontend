import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DashboardService } from '../../../core/services/dashboard.service';
import { AuthService } from '../../auth/auth.service';
import {
  DashboardSummaryResponse,
  MyOpenCaseResponse
} from '../../../core/models/dashboard.models';
import { CaseStatus } from '../../../core/models/case.models';
import { TopbarComponent } from '../shared/topbar/topbar';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, TranslocoModule, TopbarComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {

  private dashboardService = inject(DashboardService);
  private authService      = inject(AuthService);
  private router           = inject(Router);
  private transloco        = inject(TranslocoService);

  // Breadcrumb title passed to shared topbar
  pageTitle = () => this.transloco.translate('dashboard.title');

  isLoading      = signal(true);
  loadError      = signal<string | null>(null);
  summary        = signal<DashboardSummaryResponse | null>(null);
  myOpenCases    = signal<MyOpenCaseResponse[]>([]);
  isLoadingCases = signal(false);

  // HANDLER-only widget visibility (US-06)
  isHandler = computed(() => this.authService.hasRole('HANDLER'));

  // US-05 chart data — derived from summary signal
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

  ngOnInit(): void {
    this.loadSummary();
    if (this.isHandler()) {
      this.loadMyOpenCases();
    }
  }

  private loadSummary(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.dashboardService.getSummary().subscribe({
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
    this.dashboardService.getMyOpenCases().subscribe({
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

  statusBadgeClass(status: CaseStatus): string {
    const map: Record<CaseStatus, string> = {
      NEW:           'bg-blue-50 text-blue-700',
      ASSIGNED:      'bg-yellow-50 text-yellow-800',
      IN_PROGRESS:   'bg-indigo-50 text-indigo-700',
      AWAITING_INFO: 'bg-orange-50 text-orange-700',
      SUSPENDED:     'bg-gray-100 text-gray-600',
      RESOLVED:      'bg-emerald-50 text-emerald-700',
      CLOSED:        'bg-slate-100 text-slate-600',
      CANCELLED:     'bg-red-50 text-red-700'
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }

  formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  isOverdue(dueAt: string | null): boolean {
    if (!dueAt) return false;
    return new Date(dueAt).getTime() < Date.now();
  }
}