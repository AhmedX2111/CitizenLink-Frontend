import {
  Component, OnInit, signal, computed, inject, DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { switchMap } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { DashboardService } from '../../../core/services/dashboard.service';
import {
  InboxCaseResponse, InboxCountsResponse,
  InboxFilter, InboxSort
} from '../../../core/models/dashboard.models';
import {
  CaseStatus, Priority
} from '../../../core/models/case.models';
import {
  statusBadgeClass as statusBadge,
  priorityBadgeClass as priorityBadge,
  formatDate as fmtDate,
  formatDateTime as fmtDateTime,
  isOverdue as overdue
} from '../shared/utils/case-display.utils';

type StatusFilter = CaseStatus | '';
type PriorityFilter = Priority | '';
type UrgencyFilter = 'overdue' | 'dueToday' | '';

/** US-52: inbox state that round-trips through the URL query params. */
interface InboxUrlState {
  status: StatusFilter;
  priority: PriorityFilter;
  keyword: string;
  overdue: boolean;
  dueToday: boolean;
  sort: InboxSort;
  page: number;
}

@Component({
  selector: 'app-inbox',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  templateUrl: './inbox.html',
  styleUrl: './inbox.css'
})
export class InboxPageComponent implements OnInit {

  private dashboardService = inject(DashboardService);
  private router           = inject(Router);
  private route            = inject(ActivatedRoute);
  private transloco        = inject(TranslocoService);
  private destroyRef       = inject(DestroyRef);

  pageTitle = () => this.transloco.translate('dashboard.myInbox.title');

  // US-49: state
  inboxItems    = signal<InboxCaseResponse[]>([]);
  isLoading     = signal(false);
  error         = signal<string | null>(null);
  totalElements = signal(0);
  totalPages    = signal(0);
  currentPage   = signal(0);
  pageSize      = 20;

  // US-49/50: server-side filters
  statusFilter   = signal<StatusFilter>('');
  priorityFilter = signal<PriorityFilter>('');
  keywordFilter  = signal('');
  urgencyFilter  = signal<UrgencyFilter>('');   // US-50: Overdue | Due today chip (exclusive pair)
  sortFilter     = signal<InboxSort>('SMART');  // US-51

  // US-50: quick-filter badge counts
  counts = signal<InboxCountsResponse | null>(null);

  // US-52: the case just opened from this inbox (highlighted on return).
  lastOpenedCaseId = signal<string | null>(null);

  readonly statuses:   CaseStatus[] = ['NEW','ASSIGNED','IN_PROGRESS','AWAITING_INFO','SUSPENDED','RESOLVED','CLOSED','CANCELLED'];
  readonly priorities: Priority[]   = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  readonly sorts: { value: InboxSort; labelKey: string }[] = [
    { value: 'SMART',    labelKey: 'dashboard.myInbox.sort.smart' },
    { value: 'DUE_DATE', labelKey: 'dashboard.myInbox.sort.dueDate' },
    { value: 'PRIORITY', labelKey: 'dashboard.myInbox.sort.priority' },
    { value: 'NEWEST',   labelKey: 'dashboard.myInbox.sort.newest' }
  ];

  // US-50 AC4: active quick filters are always visible; one action resets all.
  hasActiveQuickFilters = computed(() =>
    this.urgencyFilter() !== '' || this.statusFilter() !== '' ||
    this.priorityFilter() !== '' || this.keywordFilter().trim() !== '');

  // Single pipeline owns all inbox HTTP calls; switchMap cancels stale
  // requests (same race-condition pattern as the cases list, problem #25).
  private reload$ = new Subject<void>();

  // Template helpers
  statusBadgeClass = statusBadge;
  priorityBadgeClass = priorityBadge;
  formatDate = fmtDate;
  formatDateTime = fmtDateTime;
  isOverdue = overdue;

  constructor() {
    this.reload$.pipe(
      switchMap(() => {
        this.isLoading.set(true);
        this.error.set(null);
        return this.dashboardService.getMyInbox(this.buildFilter());
      })
    ).subscribe({
      next: (res) => {
        this.inboxItems.set(res.content);
        this.totalElements.set(res.totalElements);
        this.totalPages.set(res.totalPages);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(
          err.status === 403
            ? this.transloco.translate('dashboard.myInbox.noPermission')
            : this.transloco.translate('dashboard.myInbox.loadError')
        );
      }
    });
  }

  ngOnInit(): void {
    // US-52: query params are the single source of truth for the inbox view
    // state (survives refresh and back-navigation from case detail). The
    // subscription APPLIES external URL changes (refresh, back-nav, link
    // share); our own writes use replaceUrl and are echoed back here too,
    // so the guard below skips the no-op re-apply/reload when the URL state
    // equals the current component state.
    let firstEmission = true;
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const restored = this.readUrlState(params);
      // The first emission always loads. Later emissions only reload when the
      // URL state actually differs (echoes of our own replaceUrl writes are
      // skipped — the mutator already applied the state and reloaded).
      if (!firstEmission && !this.urlStateDiffers(restored)) {
        return;
      }
      firstEmission = false;
      this.applyState(restored);
      this.reload$.next();
    });

    // US-50: badge counts (loaded once per visit; refreshed after each
    // deactivation-style change is out of scope here — cheap enough to
    // refresh on every navigation to the page).
    this.dashboardService.getMyInboxCounts().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (c) => this.counts.set(c),
      error: () => this.counts.set(null)   // counts are decorative; never block the inbox
    });
  }

  private buildFilter(): InboxFilter {
    const filter: InboxFilter = {
      page: this.currentPage(),
      size: this.pageSize,
      sort: this.sortFilter()
    };
    if (this.statusFilter()) filter.status = this.statusFilter() as CaseStatus;
    if (this.priorityFilter()) filter.priority = this.priorityFilter() as Priority;
    const kw = this.keywordFilter().trim();
    if (kw) filter.keyword = kw;
    if (this.urgencyFilter() === 'overdue') filter.overdue = true;
    if (this.urgencyFilter() === 'dueToday') filter.dueToday = true;
    return filter;
  }

  // ---- US-52: URL serialization -------------------------------------------

  /** Reads a query param from a plain Params object or an Angular ParamMap. */
  private readParam(params: unknown, key: string): string | undefined {
    const p = params as { get?: (k: string) => string | null; [k: string]: unknown };
    if (p && typeof p.get === 'function') {
      return p.get(key) ?? undefined;
    }
    const v = p[key];
    return typeof v === 'string' ? v : undefined;
  }

  private readUrlState(params: Record<string, string>): InboxUrlState {
    const validSorts: InboxSort[] = ['SMART', 'DUE_DATE', 'PRIORITY', 'NEWEST'];
    const sort = validSorts.includes(params['sort'] as InboxSort)
      ? (params['sort'] as InboxSort) : 'SMART';
    const status = this.readParam(params, 'status');
    const priority = this.readParam(params, 'priority');
    const keyword = this.readParam(params, 'keyword');
    return {
      status:   (this.statuses as unknown[]).includes(status) ? status as StatusFilter : '',
      priority: (this.priorities as unknown[]).includes(priority) ? priority as PriorityFilter : '',
      keyword:  keyword ?? '',
      overdue:  this.readParam(params, 'overdue') === 'true',
      dueToday: this.readParam(params, 'dueToday') === 'true',
      sort,
      page:     this.parsePage(this.readParam(params, 'page'))
    };
  }

  private parsePage(raw: string | undefined): number {
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : 0;
  }

  /** US-52: true when the URL state differs from the current component state. */
  private urlStateDiffers(state: InboxUrlState): boolean {
    return state.status !== this.statusFilter()
      || state.priority !== this.priorityFilter()
      || state.keyword !== this.keywordFilter()
      || state.overdue !== (this.urgencyFilter() === 'overdue')
      || state.dueToday !== (this.urgencyFilter() === 'dueToday')
      || state.sort !== this.sortFilter()
      || state.page !== this.currentPage();
  }

  private applyState(state: InboxUrlState): void {
    // US-50: Overdue and Due today are an exclusive pair in the UI.
    this.statusFilter.set(state.status);
    this.priorityFilter.set(state.priority);
    this.keywordFilter.set(state.keyword);
    this.urgencyFilter.set(
      state.overdue ? 'overdue' : (state.dueToday ? 'dueToday' : ''));
    this.sortFilter.set(state.sort);
    this.currentPage.set(state.page);
  }

  private writeUrlState(): void {
    const params: Record<string, string> = {};
    if (this.statusFilter()) params['status'] = this.statusFilter();
    if (this.priorityFilter()) params['priority'] = this.priorityFilter();
    if (this.keywordFilter().trim()) params['keyword'] = this.keywordFilter().trim();
    if (this.urgencyFilter() === 'overdue') params['overdue'] = 'true';
    if (this.urgencyFilter() === 'dueToday') params['dueToday'] = 'true';
    if (this.sortFilter() !== 'SMART') params['sort'] = this.sortFilter();
    if (this.currentPage() > 0) params['page'] = String(this.currentPage());
    // replaceUrl so back-navigation from the inbox itself is not polluted.
    this.router.navigate([], {
      relativeTo: this.route, queryParams: params, replaceUrl: true
    });
  }

  // ---- US-50: quick filter chips ------------------------------------------

  toggleUrgency(kind: Exclude<UrgencyFilter, ''>): void {
    this.urgencyFilter.set(this.urgencyFilter() === kind ? '' : kind);
    this.currentPage.set(0);
    this.writeUrlState();
    this.reload$.next();
  }

  // US-50: chip-style toggles for priority/status quick filters — clicking an
  // active chip again clears it (the plain on*Change setters are idempotent
  // and would leave the filter stuck on).
  togglePriority(value: Priority): void {
    this.priorityFilter.set(this.priorityFilter() === value ? '' : value);
    this.currentPage.set(0);
    this.writeUrlState();
    this.reload$.next();
  }

  toggleStatus(value: CaseStatus): void {
    this.statusFilter.set(this.statusFilter() === value ? '' : value);
    this.currentPage.set(0);
    this.writeUrlState();
    this.reload$.next();
  }

  // ---- Sort / filters / pagination -----------------------------------------

  onSortChange(value: string): void {
    this.sortFilter.set(value as InboxSort);
    this.currentPage.set(0);
    this.writeUrlState();
    this.reload$.next();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.currentPage.set(page);
    this.writeUrlState();
    this.reload$.next();
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i);
  }

  onStatusChange(value: string): void {
    this.statusFilter.set(value as StatusFilter);
    this.currentPage.set(0);
    this.writeUrlState();
    this.reload$.next();
  }

  onPriorityChange(value: string): void {
    this.priorityFilter.set(value as PriorityFilter);
    this.currentPage.set(0);
    this.writeUrlState();
    this.reload$.next();
  }

  onKeywordSearch(value: string): void {
    this.keywordFilter.set(value);
    this.currentPage.set(0);
    this.writeUrlState();
    this.reload$.next();
  }

  // US-50 AC4: one action resets every active filter.
  clearFilters(): void {
    this.statusFilter.set('');
    this.priorityFilter.set('');
    this.keywordFilter.set('');
    this.urgencyFilter.set('');
    this.currentPage.set(0);
    this.writeUrlState();
    this.reload$.next();
  }

  // US-52: remember the opened case so the row can be highlighted on return.
  openCaseDetail(caseId: string): void {
    this.lastOpenedCaseId.set(caseId);
    this.router.navigate(['/cases', caseId],
      { queryParams: { ...this.collectQueryParams() } });
  }

  private collectQueryParams(): Record<string, string> {
    const params: Record<string, string> = {};
    if (this.statusFilter()) params['status'] = this.statusFilter();
    if (this.priorityFilter()) params['priority'] = this.priorityFilter();
    if (this.keywordFilter().trim()) params['keyword'] = this.keywordFilter().trim();
    if (this.urgencyFilter() === 'overdue') params['overdue'] = 'true';
    if (this.urgencyFilter() === 'dueToday') params['dueToday'] = 'true';
    if (this.sortFilter() !== 'SMART') params['sort'] = this.sortFilter();
    if (this.currentPage() > 0) params['page'] = String(this.currentPage());
    return params;
  }
}