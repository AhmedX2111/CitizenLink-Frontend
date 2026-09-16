import {
  Component, OnInit, signal, computed, inject, DestroyRef, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule, FormBuilder, FormGroup, Validators
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { Subject, of } from 'rxjs';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { CaseService } from '../../../core/services/case.service';
import { AuthUserService } from '../../auth/auth-user.service';
import { LoggerService } from '../../../core/services/logger.service';
import {
  errorDetails, fieldErrorsFromDetails, logServerError
} from '../../../core/utils/server-error';
import { Router, ActivatedRoute } from '@angular/router';

import {
  CaseResponse, CaseSearchRequest, CaseStatus,
  CaseType, Priority, PagedResponse,
  HandlerResponse, BulkReassignResponse
} from '../../../core/models/case.models';
import { Department } from '../../../core/models/department.model';
import { Category } from '../../../core/models/category.model';
import { CaseDetailModalComponent } from './case-detail-modal/case-detail-modal';

type ActiveTab = 'list' | 'create';

@Component({
  selector: 'app-cases',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoModule],
  templateUrl: './cases.html',
  styleUrl: './cases.css'
})
export class CasesComponent implements OnInit, OnDestroy {

  private fb             = inject(FormBuilder);
  private caseService    = inject(CaseService);
  private destroyRef     = inject(DestroyRef);
  private transloco      = inject(TranslocoService);
  private router         = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private logger         = inject(LoggerService);
  private authUser       = inject(AuthUserService);
  private timers      = new Set<ReturnType<typeof setTimeout>>();
  // Breadcrumb title passed to shared topbar
  pageTitle = () => this.transloco.translate('cases.title');

  // ── UI state ──────────────────────────────────────────────────
  activeTab     = signal<ActiveTab>('list');
  isSubmitting  = signal(false);
  isLoading     = signal(false);
  submitSuccess = signal(false);
  submitError   = signal<string | null>(null);
  serverErrors  = signal<Record<string, string>>({});

  // ── List loading error state ────────────────────────────────────
  listError = signal<string | null>(null);

  // ── Lookup data loading error state ──────────────────────────────
  lookupError = signal<string | null>(null);

  // ── Case detail modal state ─────────────────────────────────────
  isModalOpen     = signal(false);
  isModalLoading  = signal(false);
  modalError      = signal<string | null>(null);
  selectedCase    = signal<CaseResponse | null>(null);

  // ── US-53: Bulk reassign state ──────────────────────────────────
  selectedCaseIds        = signal<Set<string>>(new Set());
  isReassignModalOpen    = signal(false);
  handlers               = signal<HandlerResponse[]>([]);
  bulkReassignLoading    = signal(false);
  bulkReassignError      = signal<string | null>(null);
  bulkReassignResult     = signal<BulkReassignResponse | null>(null);
  reassignHandlerId      = signal('');
  reassignComment        = signal('');
  handlerSearchTerm      = signal('');
  handlerSearchLoading   = signal(false);

  // ── Case list state ───────────────────────────────────────────
  cases         = signal<CaseResponse[]>([]);
  totalElements = signal(0);
  totalPages    = signal(0);
  currentPage   = signal(0);
  pageSize      = 20;

  // US-54: workload quick filters — applied server-side via the case-search
  // request and round-tripped in the URL so the dashboard indicator links
  // (/cases?overdue=true, etc.) land on an already-filtered list.
  quickFilters = signal<{ overdue: boolean; dueToday: boolean; unassigned: boolean }>(
    { overdue: false, dueToday: false, unassigned: false }
  );

  // Every reload of the case list goes through this single subject.
  // switchMap (wired up in ngOnInit) guarantees that triggering a reload
  // automatically cancels any still-in-flight request from a previous
  // trigger — this is what prevents a stale, slower response from
  // overwriting a newer one (e.g. fast filter typing, quick pagination
  // clicks, or rapid succession of any combination of these).
  private reloadCases$ = new Subject<void>();

  // ── Departments and Categories state ──────────────────────────
  departments = signal<Department[]>([]);
  categories = signal<Category[]>([]);
  filteredCategories = signal<Category[]>([]);

  // ── RTL detection ──────────────────────────────────────────────
  isRTL = computed(() => this.transloco.getActiveLang() === 'ar');

  // ── Enums exposed to template ─────────────────────────────────
  readonly statuses:   CaseStatus[] = ['NEW','ASSIGNED','IN_PROGRESS','AWAITING_INFO','SUSPENDED','RESOLVED','CLOSED','CANCELLED'];
  readonly types:      CaseType[]   = ['COMPLAINT', 'REQUEST'];
  readonly priorities: Priority[]   = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  readonly channels                 = ['PHONE', 'WEB', 'WALK_IN', 'EMAIL'] as const;

  // ── Search form ───────────────────────────────────────────────
  searchForm = this.fb.group({
    keyword:  [''],
    status:   ['' as CaseStatus | ''],
    type:     ['' as CaseType | ''],
    priority: ['' as Priority | ''],
  });

  // ── Create form ───────────────────────────────────────────────
  createForm: FormGroup = this.fb.group({
    subject:          ['', [Validators.required, Validators.maxLength(255)]],
    description:      ['', Validators.required],
    type:             ['', Validators.required],
    priority:         ['', Validators.required],
    channel:          ['', Validators.required],
    citizenNationalId: ['', [Validators.required, Validators.pattern(/^\d{16}$/)]],
    categoryId:       ['', Validators.required],
    departmentId:     ['', Validators.required],
    dueAt:            [''],
  });

  // ── Computed stats ────────────────────────────────────────────
  openCount     = computed(() => this.cases().filter(c => !['RESOLVED','CLOSED','CANCELLED'].includes(c.status)).length);
  urgentCount   = computed(() => this.cases().filter(c => c.priority === 'URGENT').length);
  resolvedCount = computed(() => this.cases().filter(c => c.status === 'RESOLVED').length);

  // ── US-53: Selection + role computed ──────────────────────────
  isSupervisor = computed(() =>
    this.authUser.hasRole('SUPERVISOR') || this.authUser.hasRole('ADMIN')
  );
  // US-53 / ASN-01: only these statuses may be reassigned (mirrors the backend
  // REASSIGN workflow rules). CLOSED / CANCELLED / NEW / RESOLVED are ineligible.
  readonly reassignableStatuses: readonly CaseStatus[] = ['ASSIGNED', 'IN_PROGRESS', 'AWAITING_INFO', 'SUSPENDED'];
  isReassignable = (status: CaseStatus): boolean => this.reassignableStatuses.includes(status);
  selectedCount = computed(() => this.selectedCaseIds().size);
  allSelected   = computed(() => {
    const eligible = this.cases().filter(c => this.isReassignable(c.status));
    return eligible.length > 0 && eligible.every(c => this.selectedCaseIds().has(c.id));
  });
  hasSelection  = computed(() => this.selectedCaseIds().size > 0);
  // US-53: comment is required for audit accountability (backend enforces @NotBlank).
  reassignCommentFilled = computed(() => this.reassignComment().trim().length > 0);
  // US-53: per-case failures surfaced in the result banner (no silent skips).
  bulkReassignFailures = computed(() =>
    (this.bulkReassignResult()?.results ?? []).filter(r => !r.success)
  );

  filteredHandlers = computed(() => {
    const term = this.handlerSearchTerm().trim().toLowerCase();
    if (!term) return this.handlers();
    return this.handlers().filter(h =>
      h.displayName.toLowerCase().includes(term) ||
      h.email.toLowerCase().includes(term)
    );
  });

  private schedule(fn: () => void, ms: number): void {
    const handle = setTimeout(() => {
      this.timers.delete(handle);
      fn();
    }, ms);
    this.timers.add(handle);
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }

  ngOnInit(): void {
    // Check if tab query parameter is set to 'create'
    let firstParamEmission = true;
    this.activatedRoute.queryParams.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      if (params['tab'] === 'create') {
        this.activeTab.set('create');
      }
      // US-54: apply any quick filters carried in the URL (dashboard links).
      this.applyUrlQuickFilters(params, firstParamEmission);
      firstParamEmission = false;
    });

    // Pre-fill the create form's national id from the navigation state handed
    // over by the citizen profile "create case for this citizen" action. The
    // id travels via router state (not the URL) so the sensitive national id
    // never appears in the address bar, browser history, or server logs.
    const state = this.router.getCurrentNavigation()?.extras.state as Record<string, string> | null;
    const citizenNationalId = state?.['citizenNationalId'];
    if (citizenNationalId) {
      this.createForm.patchValue({ citizenNationalId });
    }

    this.loadDepartments();
    this.loadCategories();

    // Single pipeline owns ALL case-list HTTP calls. switchMap cancels
    // any in-flight request the moment a newer reload is triggered —
    // this is what actually fixes the race condition described by the
    // lead's review (problem #25), not just a cosmetic reorder of logic.
    this.reloadCases$.pipe(
      switchMap(() => {
        this.isLoading.set(true);
        this.listError.set(null);
        const v = this.searchForm.value;
        const q = this.quickFilters();

        const filter: CaseSearchRequest = {
          page: this.currentPage(),
          size: this.pageSize,
          ...(v.keyword?.trim() && { keyword: v.keyword.trim() }),
          ...(v.status           && { status:  v.status as CaseStatus }),
          ...(v.type             && { type:    v.type   as CaseType }),
          ...(v.priority         && { priority: v.priority as Priority }),
          // US-54: workload quick filters (overdue / dueToday / unassigned)
          ...(q.overdue    && { overdue: true }),
          ...(q.dueToday   && { dueToday: true }),
          ...(q.unassigned && { unassigned: true }),
        };

        return this.caseService.searchCases(filter).pipe(
          catchError((err) => {
            this.isLoading.set(false);
            this.listError.set(
              err.status === 403
                ? this.transloco.translate('cases.errors.forbidden')
                : this.transloco.translate('cases.errors.loadFailed')
            );
            return of({ content: [], totalElements: 0, totalPages: 0,
                        page: 0, size: 0, first: true, last: true });
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res: PagedResponse<CaseResponse>) => {
        this.cases.set(res.content);
        this.totalElements.set(res.totalElements);
        this.totalPages.set(res.totalPages);
        this.isLoading.set(false);
      }
    });

    // Trigger the very first load on init.
    this.reloadCases$.next();

    // Auto-search on filter change with debounce
    this.searchForm.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged((a, b) =>
        a.keyword  === b.keyword &&
        a.status   === b.status &&
        a.type     === b.type &&
        a.priority === b.priority
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.currentPage.set(0);
      this.reloadCases$.next();
    });

    // Watch for department changes to filter categories
    this.createForm.get('departmentId')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(departmentId => {
      this.filteredCategories.set(this.categories());
      this.createForm.get('categoryId')?.setValue('');
    });
  }

  // ── Load Departments and Categories ───────────────────────────
  loadDepartments(): void {
    this.caseService.getDepartments().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (departments) => {
        this.departments.set(departments);
      },
      error: (err) => {
        this.logger.error('CasesComponent', 'Error loading departments:', err);
        this.lookupError.set(
          err.status === 403
            ? this.transloco.translate('cases.errors.forbidden')
            : this.transloco.translate('cases.errors.loadDepartmentsFailed')
        );
      }
    });
  }

  loadCategories(): void {
    this.caseService.getCategories().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.filteredCategories.set(categories);
      },
      error: (err) => {
        this.logger.error('CasesComponent', 'Error loading categories:', err);
        this.lookupError.set(
          err.status === 403
            ? this.transloco.translate('cases.errors.forbidden')
            : this.transloco.translate('cases.errors.loadCategoriesFailed')
        );
      }
    });
  }

  // ── Navigation ────────────────────────────────────────────────
  showTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
    if (tab === 'list') {
      this.submitSuccess.set(false);
      this.submitError.set(null);
      this.serverErrors.set({});
    }
  }

  // ── List / Search ─────────────────────────────────────────────
  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.currentPage.set(page);
    this.reloadCases$.next();
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i);
  }

  clearFilters(): void {
    const hadQuickFilters =
      this.quickFilters().overdue || this.quickFilters().dueToday || this.quickFilters().unassigned;
    this.searchForm.reset({ keyword: '', status: '', type: '', priority: '' });
    this.currentPage.set(0);
    // searchForm.reset() triggers valueChanges automatically, which already
    // calls reloadCases$.next() via the subscription set up in ngOnInit —
    // no separate call needed for the form itself.
    if (hadQuickFilters) {
      this.quickFilters.set({ overdue: false, dueToday: false, unassigned: false });
      this.reloadCases$.next();
    }
    // Drop the US-54 quick-filter params from the URL so a refresh is clean.
    const params: Record<string, string> = { ...this.activatedRoute.snapshot.queryParams };
    delete params['overdue'];
    delete params['dueToday'];
    delete params['unassigned'];
    if (Object.keys(params).length > 0) {
      this.router.navigate([], { relativeTo: this.activatedRoute, queryParams: params });
    }
  }

  // ── Create Case ───────────────────────────────────────────────
  onSubmit(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);
    this.serverErrors.set({});

    const v = this.createForm.value;
    const payload = {
      subject:          v.subject,
      description:      v.description,
      type:             v.type,
      priority:         v.priority,
      channel:          v.channel,
      citizenNationalId: v.citizenNationalId,
      categoryId:       v.categoryId,
      departmentId:     v.departmentId,
      ...(v.dueAt            && { dueAt: new Date(v.dueAt).toISOString() }),
    };

    this.caseService.createCase(payload).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.submitSuccess.set(true);
        this.createForm.reset();
        this.reloadCases$.next();
        this.schedule(() => this.showTab('list'), 1500);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        logServerError(this.logger, 'CasesComponent', err);
        const details = errorDetails(err);
        if (err.status === 400 && details.length > 0) {
          this.serverErrors.set(
            fieldErrorsFromDetails(details, this.transloco.translate('cases.create.errors.validationFailed'))
          );
        } else if (err.status === 404) {
          this.submitError.set(this.transloco.translate('cases.create.errors.citizenNotFound'));
        } else {
          this.submitError.set(this.transloco.translate('cases.create.errors.unexpected'));
        }
      }
    });
  }

  resetForm(): void {
    this.createForm.reset();
    this.submitSuccess.set(false);
    this.submitError.set(null);
    this.serverErrors.set({});
  }

  // ── Template helpers ──────────────────────────────────────────
  hasError(field: string): boolean {
    const c = this.createForm.get(field);
    return !!(c && c.invalid && c.touched);
  }

  fieldError(field: string): string {
    const ctrl = this.createForm.get(field);
    if (!ctrl?.errors) return '';
    if (ctrl.errors['required']) return 'This field is required';
    if (ctrl.errors['maxlength']) return `Maximum ${ctrl.errors['maxlength'].requiredLength} characters`;
    if (ctrl.errors['pattern']) return 'National ID must be exactly 16 digits';
    return '';
  }

  serverError(field: string): string {
    return this.serverErrors()[field] ?? '';
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

  typeBadgeClass(type: CaseType): string {
    return type === 'COMPLAINT'
      ? 'bg-purple-50 text-purple-700'
      : 'bg-teal-50 text-teal-700';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  // // ── Case detail modal ──────────────────────────────────────────
  // openCaseDetail(caseId: string): void {
  //   this.isModalOpen.set(true);
  //   this.isModalLoading.set(true);
  //   this.modalError.set(null);
  //   this.selectedCase.set(null);

  //   this.caseService.getCaseById(caseId).pipe(
  //     takeUntilDestroyed(this.destroyRef)
  //   ).subscribe({
  //     next: (res) => {
  //       this.selectedCase.set(res);
  //       this.isModalLoading.set(false);
  //     },
  //     error: (err) => {
  //       this.isModalLoading.set(false);
  //       this.modalError.set(
  //         err.status === 404
  //           ? this.transloco.translate('cases.detail.notFound')
  //           : this.transloco.translate('cases.detail.loadError')
  //       );
  //     }
  //   });
  // }

  // closeCaseDetail(): void {
  //   this.isModalOpen.set(false);
  //   this.selectedCase.set(null);
  //   this.modalError.set(null);
  // }
 
  // ── Navigate to case detail page (US-14) ─────────────────────────
  openCaseDetail(caseId: string): void {
    this.router.navigate(['/cases', caseId]);
  }

  // ── US-53: Bulk reassign ─────────────────────────────────────────

  toggleSelectAll(): void {
    if (this.allSelected()) {
      this.selectedCaseIds.set(new Set());
    } else {
      // US-53: select only the reassignable rows on the current page —
      // ineligible cases (closed/cancelled/new/resolved) are never selectable.
      this.selectedCaseIds.set(
        new Set(this.cases().filter(c => this.isReassignable(c.status)).map(c => c.id))
      );
    }
  }

  toggleSelect(caseId: string, event: Event): void {
    event.stopPropagation();
    const target = this.cases().find(c => c.id === caseId);
    if (!target || !this.isReassignable(target.status)) return;
    const current = new Set(this.selectedCaseIds());
    if (current.has(caseId)) {
      current.delete(caseId);
    } else {
      current.add(caseId);
    }
    this.selectedCaseIds.set(current);
  }

  // ── US-54: Workload quick filters (URL round-trip) ──────────────
  // Toggles a quick filter, reloads the list with it, and syncs the URL so the
  // state is refresh-safe and shareable (mirrors the inbox US-52 pattern).
  toggleQuickFilter(key: 'overdue' | 'dueToday' | 'unassigned'): void {
    const next = { ...this.quickFilters(), [key]: !this.quickFilters()[key] };
    this.quickFilters.set(next);
    this.currentPage.set(0);
    this.reloadCases$.next();
    const params: Record<string, string> = { ...this.activatedRoute.snapshot.queryParams };
    (['overdue', 'dueToday', 'unassigned'] as const).forEach(k => {
      if (next[k]) params[k] = 'true';
      else delete params[k];
    });
    this.router.navigate([], { relativeTo: this.activatedRoute, queryParams: params });
  }

  // Applies quick filters carried in the URL (e.g. arriving from a dashboard
  // workload indicator). The first emission during init seeds the signals
  // before the initial list load; later emissions (back/forward, in-app nav)
  // reload when the values actually change.
  applyUrlQuickFilters(params: Record<string, string>, isFirst: boolean): void {
    const next = {
      overdue:    params['overdue'] === 'true',
      dueToday:   params['dueToday'] === 'true',
      unassigned: params['unassigned'] === 'true'
    };
    const q = this.quickFilters();
    if (q.overdue === next.overdue && q.dueToday === next.dueToday && q.unassigned === next.unassigned) {
      return;
    }
    this.quickFilters.set(next);
    if (!isFirst) {
      this.currentPage.set(0);
      this.reloadCases$.next();
    }
  }

  openReassignModal(): void {
    if (!this.hasSelection()) return;
    this.bulkReassignError.set(null);
    this.bulkReassignResult.set(null);
    this.reassignHandlerId.set('');
    this.reassignComment.set('');
    this.handlerSearchTerm.set('');
    this.isReassignModalOpen.set(true);
    this.loadHandlers();
  }

  closeReassignModal(): void {
    this.isReassignModalOpen.set(false);
    this.bulkReassignError.set(null);
    this.bulkReassignResult.set(null);
  }

  onHandlerSearch(term: string): void {
    this.handlerSearchTerm.set(term);
  }

  selectHandler(handlerId: string): void {
    this.reassignHandlerId.set(handlerId);
  }

  submitBulkReassign(): void {
    if (!this.reassignHandlerId()) {
      this.bulkReassignError.set(this.transloco.translate('cases.bulkReassign.handlerRequired'));
      return;
    }
    // US-53 / AUD-01: a reason is required so every reassignment is auditable.
    if (!this.reassignCommentFilled()) {
      this.bulkReassignError.set(this.transloco.translate('cases.bulkReassign.commentRequired'));
      return;
    }

    this.bulkReassignLoading.set(true);
    this.bulkReassignError.set(null);
    this.bulkReassignResult.set(null);

    this.caseService.bulkReassignCases({
      caseIds: Array.from(this.selectedCaseIds()),
      assignedToUserId: this.reassignHandlerId(),
      comment: this.reassignComment(),
    }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.bulkReassignLoading.set(false);
        this.bulkReassignResult.set(res);
        if (res.failed === 0) {
          this.selectedCaseIds.set(new Set());
          this.reloadCases$.next();
        }
      },
      error: (err) => {
        this.bulkReassignLoading.set(false);
        this.bulkReassignError.set(
          err.status === 403
            ? this.transloco.translate('cases.errors.forbidden')
            : this.transloco.translate('cases.bulkReassign.loadFailed')
        );
      }
    });
  }

  private loadHandlers(): void {
    this.handlerSearchLoading.set(true);
    this.caseService.getHandlers().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (handlers) => {
        this.handlers.set(handlers);
        this.handlerSearchLoading.set(false);
      },
      error: () => {
        this.handlerSearchLoading.set(false);
        this.bulkReassignError.set(this.transloco.translate('cases.bulkReassign.handlersLoadError'));
      }
    });
  }
}