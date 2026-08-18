import {
  Component, OnInit, signal, computed, inject,
  DestroyRef, AfterViewInit, ElementRef, ViewChild, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { ReportService } from '../../../core/services/report.service';
import { VolumeReportResponse } from '../../../core/models/report.models';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-volume-report',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  templateUrl: './volume-report.html',
  styleUrl: './volume-report.css'
})
export class VolumeReportComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('categoryChartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  private reportService = inject(ReportService);
  private destroyRef    = inject(DestroyRef);
  private transloco     = inject(TranslocoService);
  private reload$       = new Subject<void>();

  // ── Date range ────────────────────────────────────────────────
  toDate   = this.formatDate(new Date());
  fromDate = this.formatDate(this.daysAgo(6));

  // ── State ─────────────────────────────────────────────────────
  isLoading   = signal(false);
  isExporting = signal(false);
  loadError   = signal<string | null>(null);
  report      = signal<VolumeReportResponse | null>(null);

  // ── Chart ─────────────────────────────────────────────────────
  private chartInstance: Chart | null = null;
  private chartReady = false;

  // ── Computed totals ───────────────────────────────────────────
  totalCreated  = computed(() =>
    this.report()?.dailyVolume.reduce((s, r) => s + r.created,  0) ?? 0);
  totalResolved = computed(() =>
    this.report()?.dailyVolume.reduce((s, r) => s + r.resolved, 0) ?? 0);

  ngOnInit(): void {
    this.reload$.pipe(
      switchMap(() => {
        this.isLoading.set(true);
        this.loadError.set(null);
        return this.reportService.getVolumeReport(this.fromDate, this.toDate).pipe(
          catchError((err) => {
            this.isLoading.set(false);
            this.loadError.set(
              err.status === 403
                ? this.transloco.translate('reports.errors.forbidden')
                : this.transloco.translate('reports.errors.loadFailed')
            );
            return of(null);
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((res) => {
      if (res) {
        this.report.set(res);
        this.isLoading.set(false);
        if (this.chartReady) this.renderChart();
      }
    });

    this.reload$.next();
  }

  ngAfterViewInit(): void {
    this.chartReady = true;
    if (this.report()) this.renderChart();
  }

  ngOnDestroy(): void {
    this.chartInstance?.destroy();
  }

  applyFilter(): void {
    if (!this.fromDate || !this.toDate) return;
    if (this.fromDate > this.toDate) {
      this.loadError.set(this.transloco.translate('reports.errors.invalidRange'));
      return;
    }
    this.reload$.next();
  }

  // ── Export CSV ────────────────────────────────────────────────
  exportToCsv(): void {
    if (this.isExporting()) return;
    this.isExporting.set(true);
    this.loadError.set(null);

    this.reportService.exportCsv(this.fromDate, this.toDate).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `citizenlink-cases-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        this.isExporting.set(false);
      },
      error: (err) => {
        this.isExporting.set(false);
        this.loadError.set(
          err.status === 403
            ? this.transloco.translate('reports.errors.forbidden')
            : this.transloco.translate('reports.export.error')
        );
      }
    });
  }

  private renderChart(): void {
    const cats = this.report()?.topCategories ?? [];
    if (!cats.length || !this.chartCanvas) return;

    if (this.chartInstance) this.chartInstance.destroy();

    const isAr = this.transloco.getActiveLang() === 'ar';

    this.chartInstance = new Chart(this.chartCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: cats.map(c => isAr ? c.categoryNameAr : c.categoryNameEn),
        datasets: [{
          data: cats.map(c => c.count),
          backgroundColor: ['#002045','#1a365d','#2d476f','#455f88','#6080a8'],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.raw} cases`
            }
          }
        }
      }
    });
  }

  private formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  formatDisplayDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }
}
