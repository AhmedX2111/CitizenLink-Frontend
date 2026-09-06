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
import { LoggerService } from '../../../core/services/logger.service';
import {
  errorDetails, fieldErrorsFromDetails, logServerError
} from '../../../core/utils/server-error';
import { Router, ActivatedRoute } from '@angular/router';

import {
  CaseResponse, CaseSearchRequest, CaseStatus,
  CaseType, Priority, PagedResponse, CreateCitizenCaseRequest,
  DuplicateCaseCandidateResponse
} from '../../../core/models/case.models';
import { CitizenService } from '../../../core/services/citizen.service';
import { Department } from '../../../core/models/department.model';
import { Category } from '../../../core/models/category.model';

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
  private citizenService = inject(CitizenService);
  private destroyRef     = inject(DestroyRef);
  private transloco      = inject(TranslocoService);
  private router         = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private logger         = inject(LoggerService);
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

  // ── US-57: citizen locked in from the Citizen 360 screen ─────────
  // Set when the agent opened the create form from a citizen profile.
  // While set, the citizen section renders a locked card (name + masked
  // national id for display) instead of the free-typed national id field,
  // and submission goes to POST /citizens/{id}/cases. The citizen is only
  // ever released by an explicit "change citizen" action — never silently.
  linkedCitizen = signal<{ id: string; name: string; nationalId: string } | null>(null);
  linkedCitizenLoading = signal(false);
  // Bumped every time the linked citizen is (re)requested or released so a
  // stale in-flight lookup can never resurrect a citizen the user already
  // changed or reset.
  private citizenLinkGeneration = 0;

  // ── US-58: possible-duplicate open-case preflight ──────────────────
  // Read-only check run before creating a case for a locked citizen so the
  // agent can be warned about already-open cases on the same citizen that
  // overlap on category or department. The server never blocks creation —
  // the warning is advisory; the agent may continue by confirming a short
  // reason that is recorded on the new case. A failed check also never
  // blocks (the Agent proceeds without a warning).
  duplicateCandidates  = signal<DuplicateCaseCandidateResponse[]>([]);
  duplicateChecking    = signal(false);  // a preflight request is in flight
  duplicateWarning     = signal(false);  // open candidates exist -> warn UI
  duplicateOverride    = signal(false);  // agent confirmed continuation
  duplicateCheckFailed = signal(false);  // preflight errored -> proceed clean
  // Signature (citizen|category|department) the last COMPLETED result covers;
  // '' means inputs changed or nothing was checked for the current tuple.
  private checkedSignature = '';
  // Bumped whenever a check input changes so a stale in-flight response can
  // never resurrect an older warning (mirrors citizenLinkGeneration).
  private duplicateCheckGeneration = 0;
  // True while onSubmit() is waiting on a freshly-triggered preflight before
  // it may create (or stop on a warning).
  private submitAfterCheck = false;
  // Debounced so rapid category/department changes result in at most one
  // request per 600ms of quiet instead of one per keystroke of the dropdowns.
  private duplicateCheckTrigger$ = new Subject<void>();

  // ── List loading error state ────────────────────────────────────
  listError = signal<string | null>(null);

  // ── Lookup data loading error state ──────────────────────────────
  lookupError = signal<string | null>(null);

  // ── Case detail modal state ─────────────────────────────────────
  isModalOpen     = signal(false);
  isModalLoading  = signal(false);
  modalError      = signal<string | null>(null);
  selectedCase    = signal<CaseResponse | null>(null);

  // ── Case list state ───────────────────────────────────────────
  cases         = signal<CaseResponse[]>([]);
  totalElements = signal(0);
  totalPages    = signal(0);
  currentPage   = signal(0);
  pageSize      = 20;

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
  // citizenNationalId is only *required* when no citizen is locked in
  // (US-57). The required validator is (re)applied by syncCitizenValidators()
  // once we know whether the form was opened from the Citizen 360 screen.
  createForm: FormGroup = this.fb.group({
    subject:          ['', [Validators.required, Validators.maxLength(255)]],
    description:      ['', Validators.required],
    type:             ['', Validators.required],
    priority:         ['', Validators.required],
    channel:          ['', Validators.required],
    citizenNationalId: ['', [Validators.pattern(/^\d{16}$/)]],
    categoryId:       ['', Validators.required],
    departmentId:     ['', Validators.required],
    dueAt:            [''],
    duplicateReason:  ['', [Validators.maxLength(500)]],
  });

  // ── Computed stats ────────────────────────────────────────────
  openCount     = computed(() => this.cases().filter(c => !['RESOLVED','CLOSED','CANCELLED'].includes(c.status)).length);
  urgentCount   = computed(() => this.cases().filter(c => c.priority === 'URGENT').length);
  resolvedCount = computed(() => this.cases().filter(c => c.status === 'RESOLVED').length);

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
    // Check if tab query parameter is set to 'create', and if the form was
    // launched from Citizen 360 (?citizenId=...) lock that citizen in.
    this.activatedRoute.queryParams.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      if (params['tab'] === 'create') {
        this.activeTab.set('create');
      }
      this.linkCitizenFromParams(params['citizenId'] ?? null);
    });

    // Legacy fallback (M-27): a caller that only hands over a national id
    // through router state keeps the old pre-fill behaviour.
    const state = this.router.getCurrentNavigation()?.extras.state as Record<string, string> | null;
    if (state?.['citizenNationalId']) {
      this.createForm.patchValue({ citizenNationalId: state['citizenNationalId'] });
    }
    this.syncCitizenValidators();

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

        const filter: CaseSearchRequest = {
          page: this.currentPage(),
          size: this.pageSize,
          ...(v.keyword?.trim() && { keyword: v.keyword.trim() }),
          ...(v.status           && { status:  v.status as CaseStatus }),
          ...(v.type             && { type:    v.type   as CaseType }),
          ...(v.priority         && { priority: v.priority as Priority }),
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

    // US-58: live duplicate pre-check, debounced. Once the agent has chosen a
    // category and department for a locked citizen, the form quietly asks the
    // server for open candidates so the warning is already visible before the
    // agent presses "Create Case" (it is also re-run at submit time as a
    // safety net — see onSubmit()/runDuplicateCheck()).
    this.duplicateCheckTrigger$.pipe(
      debounceTime(600),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.runDuplicateCheck());

    ['categoryId', 'departmentId'].forEach(name =>
      this.createForm.get(name)?.valueChanges.pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(() => this.scheduleDuplicateCheck())
    );
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

  // ── US-57: locked citizen handling ───────────────────────────
  // The /cases page is launched from Citizen 360 as /cases?citizenId=<uuid>
  // — the same identifier the profile route itself carries, so no new PII
  // enters the URL. We resolve the citizen's display data via the existing
  // (role-masked) getCitizenById endpoint and lock it into the form.
  private linkCitizenFromParams(citizenId: string | null): void {
    if (!citizenId) return;
    if (this.linkedCitizen()?.id === citizenId) return;

    const generation = ++this.citizenLinkGeneration;
    this.linkedCitizenLoading.set(true);

    this.citizenService.getCitizenById(citizenId).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (citizen) => {
        if (generation !== this.citizenLinkGeneration) return;
        this.linkedCitizen.set({
          id: citizen.id,
          name: citizen.fullName,
          nationalId: citizen.nationalId
        });
        this.linkedCitizenLoading.set(false);
        this.syncCitizenValidators();
        this.scheduleDuplicateCheck();
      },
      error: (err) => {
        if (generation !== this.citizenLinkGeneration) return;
        this.logger.error('CasesComponent', 'Failed to load linked citizen:', err);
        this.linkedCitizenLoading.set(false);
      }
    });
  }

  // (Re)apply the citizenNationalId validators to match whether a citizen
  // is locked in. Required when free-typed, unneeded when locked (the
  // citizen is resolved server-side by id).
  syncCitizenValidators(): void {
    const ctrl = this.createForm.get('citizenNationalId');
    if (!ctrl) return;
    const pattern = Validators.pattern(/^\d{16}$/);
    ctrl.setValidators(this.linkedCitizen() ? [pattern] : [Validators.required, pattern]);
    ctrl.updateValueAndValidity();
  }

  // Explicit, user-initiated: releases the locked citizen and returns focus
  // to the free-typed national id field. The citizen is never swapped by the
  // system itself while the flow is in progress.
  changeCitizen(): void {
    this.citizenLinkGeneration++;
    this.linkedCitizen.set(null);
    this.linkedCitizenLoading.set(false);
    this.serverErrors.set({});
    this.invalidateDuplicateCheck();
    this.syncCitizenValidators();
  }

  // "Cancel" / back action. When launched from Citizen 360 this returns the
  // agent to that same citizen profile; otherwise it just swaps to the list.
  cancelCreate(): void {
    const linked = this.linkedCitizen();
    if (linked?.id) {
      this.router.navigate(['/app/call-center/citizen', linked.id]);
      return;
    }
    this.showTab('list');
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
    this.searchForm.reset({ keyword: '', status: '', type: '', priority: '' });
    this.currentPage.set(0);
    // searchForm.reset() triggers valueChanges automatically, which already
    // calls reloadCases$.next() via the subscription set up in ngOnInit —
    // no separate call needed here.
  }

  // ── Create Case ───────────────────────────────────────────────
  onSubmit(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    this.submitError.set(null);
    this.serverErrors.set({});

    const linked = this.linkedCitizen();
    // US-58: the duplicate preflight only applies to the Citizen 360 flow —
    // the check endpoint needs the citizen UUID, which free-typed creation
    // (national-id only) does not have.
    if (!linked) {
      this.createCase();
      return;
    }

    const signature = this.currentDuplicateSignature();

    // A preflight for exactly these inputs is already in flight — the safe
    // move is to wait for it instead of creating under a possibly-dirty form.
    if (this.duplicateChecking()) {
      this.submitAfterCheck = true;
      return;
    }

    if (this.checkedSignature === signature) {
      // Fresh result for exactly these inputs already exists.
      if (this.duplicateCheckFailed()) {
        // Advisory only: a failing check never blocks creation.
        this.createCase();
        return;
      }
      if (this.duplicateWarning() && !this.duplicateOverride()) {
        // Warning panel is already showing; the agent must confirm a reason
        // (the panel's "Continue" button — not the form's "Create Case").
        this.createForm.get('duplicateReason')?.markAsTouched();
        return;
      }
      this.createCase();
      return;
    }

    // No fresh result yet for the current inputs — run the preflight now and
    // resume from its completion.
    this.submitAfterCheck = true;
    this.runDuplicateCheck();
  }

  // US-58: the only path that reaches the actual create. Handles both the
  // generic endpoint (free-typed national id) and the citizen-scoped endpoint
  // (locked citizen), attaching the confirmed duplicate-reason when the agent
  // overrode a duplicate warning.
  private createCase(): void {
    const linked = this.linkedCitizen();
    const v = this.createForm.value;

    const reason = ((this.createForm.get('duplicateReason')?.value ?? '') as string).trim();
    if (this.duplicateWarning() && !this.duplicateOverride() && !reason) {
      // Safety net: never send a blank override reason.
      this.createForm.get('duplicateReason')?.markAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);
    this.serverErrors.set({});

    const base = {
      subject:          v.subject,
      description:      v.description,
      type:             v.type,
      priority:         v.priority,
      channel:          v.channel,
      categoryId:       v.categoryId,
      departmentId:     v.departmentId,
      ...(v.dueAt            && { dueAt: new Date(v.dueAt).toISOString() }),
      // US-58: only sent when the agent explicitly confirmed continuation.
      ...(this.duplicateOverride() && reason ? { duplicateReason: reason } : {}),
    };

    // US-57: a locked citizen posts to the citizen-scoped endpoint (no
    // national id in the body); otherwise the generic endpoint with the
    // free-typed national id.
    const create$ = linked
      ? this.caseService.createCaseForCitizen(linked.id, base as CreateCitizenCaseRequest)
      : this.caseService.createCase({ ...base, citizenNationalId: v.citizenNationalId });

    create$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (created) => {
        this.isSubmitting.set(false);
        if (linked) {
          // US-57: land directly on the new case's detail page so the
          // agent immediately sees the generated case id.
          this.router.navigate(['/cases', created.id]);
          return;
        }
        this.submitSuccess.set(true);
        this.createForm.reset();
        this.invalidateDuplicateCheck();
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

  // US-58 helpers ─────────────────────────────────────────────────

  // Agent confirmed the warning: record the mandatory reason and create.
  continueWithDuplicate(): void {
    const reason = ((this.createForm.get('duplicateReason')?.value ?? '') as string).trim();
    if (!reason) {
      this.createForm.get('duplicateReason')?.markAsTouched();
      return;
    }
    this.duplicateOverride.set(true);
    this.createCase();
  }

  // One preflight request for the CURRENT (citizen, category, department).
  // Guards itself with a generation counter so a response that arrives after
  // the inputs changed again is dropped (never resurrects an old warning).
  private runDuplicateCheck(): void {
    const linked = this.linkedCitizen();
    const categoryId   = this.createForm.get('categoryId')?.value;
    const departmentId = this.createForm.get('departmentId')?.value;

    if (!linked || !categoryId || !departmentId) {
      this.duplicateChecking.set(false);
      this.duplicateWarning.set(false);
      this.duplicateOverride.set(false);
      this.duplicateCandidates.set([]);
      this.duplicateCheckFailed.set(false);
      this.checkedSignature = '';
      this.resumeSubmitIfPending();
      return;
    }

    const generation = ++this.duplicateCheckGeneration;
    const signature  = `${linked.id}|${categoryId}|${departmentId}`;
    this.checkedSignature = '';
    this.duplicateChecking.set(true);
    this.duplicateCheckFailed.set(false);

    this.caseService.checkDuplicateCases(linked.id, categoryId, departmentId).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (candidates) => {
        if (generation !== this.duplicateCheckGeneration) return;
        this.duplicateChecking.set(false);
        this.checkedSignature = signature;
        this.duplicateCandidates.set(candidates);
        this.duplicateCheckFailed.set(false);
        this.duplicateWarning.set(candidates.length > 0);
        this.duplicateOverride.set(false);
        this.resumeSubmitIfPending();
      },
      error: (err) => {
        if (generation !== this.duplicateCheckGeneration) return;
        this.logger.error('CasesComponent', 'US-58 duplicate pre-check failed:', err);
        this.duplicateChecking.set(false);
        this.checkedSignature = signature;
        this.duplicateCandidates.set([]);
        this.duplicateWarning.set(false);
        this.duplicateOverride.set(false);
        this.duplicateCheckFailed.set(true);
        this.resumeSubmitIfPending();
      }
    });
  }

  // Invalidate everything derived from a previous preflight: called whenever
  // the citizen, category or department that scope the check changes.
  private invalidateDuplicateCheck(): void {
    this.duplicateCheckGeneration++;
    this.checkedSignature = '';
    this.submitAfterCheck = false;
    this.duplicateChecking.set(false);
    this.duplicateWarning.set(false);
    this.duplicateOverride.set(false);
    this.duplicateCandidates.set([]);
    this.duplicateCheckFailed.set(false);
  }

  // Invalidate + (debounced) re-trigger: used by the live input watchers and
  // right after a citizen is locked in.
  private scheduleDuplicateCheck(): void {
    this.invalidateDuplicateCheck();
    this.duplicateCheckTrigger$.next();
  }

  private currentDuplicateSignature(): string {
    const linked = this.linkedCitizen();
    const categoryId   = this.createForm.get('categoryId')?.value;
    const departmentId = this.createForm.get('departmentId')?.value;
    if (!linked || !categoryId || !departmentId) return '';
    return `${linked.id}|${categoryId}|${departmentId}`;
  }

  // When onSubmit() had to wait for a preflight it triggered, this runs once
  // the preflight lands: create if the way is clean, otherwise stay blocked
  // on the warning panel.
  private resumeSubmitIfPending(): void {
    if (!this.submitAfterCheck) return;
    this.submitAfterCheck = false;
    // The agent may have edited the form while the check flew.
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    if (this.duplicateWarning() && !this.duplicateOverride()) {
      this.createForm.get('duplicateReason')?.markAsTouched();
      return;
    }
    this.createCase();
  }

  duplicateReasonInvalid(): boolean {
    const ctrl = this.createForm.get('duplicateReason');
    if (!ctrl?.touched) return false;
    return !((ctrl.value ?? '') as string).trim();
  }

  resetForm(): void {
    this.citizenLinkGeneration++;
    this.createForm.reset();
    this.linkedCitizen.set(null);
    this.linkedCitizenLoading.set(false);
    this.invalidateDuplicateCheck();
    this.syncCitizenValidators();
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
}