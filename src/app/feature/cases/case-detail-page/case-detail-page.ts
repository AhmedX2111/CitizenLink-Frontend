import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { CaseService } from '../../../../core/services/case.service';
import { TopbarComponent } from '../../shared/topbar/topbar';
import {
  CaseResponse, CaseStatus, Priority, CaseType,
  StatusHistoryResponse, WorkflowAction, CaseActionResponse
} from '../../../../core/models/case.models';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-case-detail-page',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoModule, TopbarComponent, FormsModule],
  templateUrl: './case-detail-page.html',
  styleUrl: './case-detail-page.css'
})
export class CaseDetailPageComponent implements OnInit {

  private route        = inject(ActivatedRoute);
  private router        = inject(Router);
  private caseService   = inject(CaseService);
  private transloco     = inject(TranslocoService);
  private destroyRef    = inject(DestroyRef);

  pageTitle = () => this.transloco.translate('cases.detail.title');

  // ── Header state ──────────────────────────────────────────────
  isLoading   = signal(true);
  loadError   = signal<string | null>(null);
  caseDetail  = signal<CaseResponse | null>(null);

  // ── Timeline state ────────────────────────────────────────────
  isTimelineLoading = signal(true);
  timelineError      = signal<string | null>(null);
  timeline           = signal<StatusHistoryResponse[]>([]);

  // ── Actions state (US-17) ────────────────────────────────────────
  isActionsLoading   = signal(true);
  actionsError        = signal<string | null>(null);
  availableActions    = signal<CaseActionResponse[]>([]);

  // ── Transition modal state ───────────────────────────────────────
  pendingAction       = signal<CaseActionResponse | null>(null);
  transitionComment    = '';
  transitionResolution = '';
  isSubmittingAction   = signal(false);
  transitionError      = signal<string | null>(null);


  ngOnInit(): void {
    const caseId = this.route.snapshot.paramMap.get('id');

    if (!caseId) {
      this.loadError.set(this.transloco.translate('cases.detail.notFound'));
      this.isLoading.set(false);
      this.isTimelineLoading.set(false);
      this.isActionsLoading.set(false);
      return;
    }

    this.loadCaseDetail(caseId);
    this.loadTimeline(caseId);
    this.loadActions(caseId);
  }

  private loadCaseDetail(caseId: string): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.caseService.getCaseById(caseId).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.caseDetail.set(res);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.loadError.set(
          err.status === 404
            ? this.transloco.translate('cases.detail.notFound')
            : this.transloco.translate('cases.detail.loadError')
        );
      }
    });
  }

  private loadTimeline(caseId: string): void {
    this.isTimelineLoading.set(true);
    this.timelineError.set(null);

    this.caseService.getCaseTimeline(caseId).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.timeline.set(res);
        this.isTimelineLoading.set(false);
      },
      error: (err) => {
        this.isTimelineLoading.set(false);
        this.timelineError.set(
          err.status === 404
            ? this.transloco.translate('cases.detail.notFound')
            : this.transloco.translate('cases.detail.timelineLoadError')
        );
      }
    });
  }


  private loadActions(caseId: string): void {
    this.isActionsLoading.set(true);
    this.actionsError.set(null);

    this.caseService.getCaseActions(caseId).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.availableActions.set(res);
        this.isActionsLoading.set(false);
      },
      error: (err) => {
        this.isActionsLoading.set(false);
        // Non-fatal: a failure here just means no action buttons show.
        // The page itself is still usable for viewing.
        this.actionsError.set(this.transloco.translate('cases.detail.actionsLoadError'));
      }
    });
  }

  // ── Transition handling ──────────────────────────────────────────
  openActionModal(action: CaseActionResponse): void {
    this.pendingAction.set(action);
    this.transitionComment = '';
    this.transitionResolution = '';
    this.transitionError.set(null);
  }

  closeActionModal(): void {
    this.pendingAction.set(null);
  }

  submitAction(): void {
    const action = this.pendingAction();
    const caseId = this.caseDetail()?.id;
    if (!action || !caseId) return;

    if (action.requiresComment && !this.transitionComment.trim()) {
      this.transitionError.set(this.transloco.translate('cases.detail.commentRequired'));
      return;
    }
    if (action.requiresResolutionSummary && !this.transitionResolution.trim()) {
      this.transitionError.set(this.transloco.translate('cases.detail.resolutionRequired'));
      return;
    }

    this.isSubmittingAction.set(true);
    this.transitionError.set(null);

    this.caseService.transitionCase(caseId, {
      action: action.action,
      ...(action.requiresComment && { comment: this.transitionComment.trim() }),
      ...(action.requiresResolutionSummary && { resolutionSummary: this.transitionResolution.trim() })
    }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (updatedCase) => {
        this.isSubmittingAction.set(false);
        this.caseDetail.set(updatedCase);
        this.closeActionModal();
        this.loadTimeline(caseId);
        this.loadActions(caseId);
      },
      error: (err) => {
        this.isSubmittingAction.set(false);
        this.transitionError.set(
          err.status === 409
            ? (err.error?.message ?? this.transloco.translate('cases.detail.transitionConflict'))
            : this.transloco.translate('cases.detail.transitionFailed')
        );
      }
    });
  }

  goToCitizenProfile(citizenId: string): void {
    this.router.navigate(['/app/call-center/citizen', citizenId]);
  }

  goBack(): void {
    this.router.navigate(['/cases']);
  }

  // ── Template helpers ──────────────────────────────────────────
  statusBadgeClass(status: CaseStatus): string {
    const map: Record<CaseStatus, string> = {
      NEW:           'bg-blue-50 text-blue-700',
      ASSIGNED:      'bg-yellow-50 text-yellow-800',
      IN_PROGRESS:   'bg-indigo-50 text-indigo-700',
      AWAITING_INFO: 'bg-orange-50 text-orange-700',
      SUSPENDED:     'bg-gray-100 text-gray-600',
      RESOLVED:      'bg-emerald-50 text-emerald-700',
      CLOSED:        'bg-slate-100 text-slate-600',
      CANCELLED:     'bg-red-50 text-red-700',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }

  priorityBadgeClass(priority: Priority): string {
    const map: Record<Priority, string> = {
      LOW:    'bg-emerald-50 text-emerald-700',
      MEDIUM: 'bg-yellow-50 text-yellow-800',
      HIGH:   'bg-orange-50 text-orange-700',
      URGENT: 'bg-red-50 text-red-700',
    };
    return map[priority] ?? 'bg-gray-100 text-gray-600';
  }

  isOverdue(dueAt: string | null): boolean {
    if (!dueAt) return false;
    return new Date(dueAt).getTime() < Date.now();
  }

  formatDateTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  /**
   * For the initial CREATE event, fromStatus is null. The timeline UI
   * must render this as "Case created" rather than "null -> NEW".
   */
  isCreationEvent(entry: StatusHistoryResponse): boolean {
    return entry.fromStatus === null;
  }
}