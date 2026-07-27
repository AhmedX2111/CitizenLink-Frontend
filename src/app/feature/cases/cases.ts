import {
  Component, OnInit, signal, computed, inject, DestroyRef
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
import { Router } from '@angular/router';

import {
  CaseResponse, CaseSearchRequest, CaseStatus,
  CaseType, Priority, PagedResponse
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
export class CasesComponent implements OnInit {

  private fb          = inject(FormBuilder);
  private caseService = inject(CaseService);
  private destroyRef  = inject(DestroyRef);
  private transloco   = inject(TranslocoService);
  private router      = inject(Router);
  private logger      = inject(LoggerService);
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

  ngOnInit(): void {

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
      distinctUntilChanged(),
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
        setTimeout(() => this.showTab('list'), 1500);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        if (err.status === 400 && err.error?.fieldErrors) {
          this.serverErrors.set(err.error.fieldErrors);
        } else if (err.status === 404) {
          this.submitError.set(err.error?.message ?? 'Citizen not found with this National ID.');
        } else {
          this.submitError.set('An unexpected error occurred. Please try again.');
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
}