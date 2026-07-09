import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminService } from '../../../../core/services/admin.service';
import { Category, CreateCategoryPayload, UpdateCategoryPayload } from '../../../../core/models/category.model';
import { Department, CreateDepartmentPayload, UpdateDepartmentPayload } from '../../../../core/models/department.model';

type ActiveTab = 'categories' | 'departments';

@Component({
  selector: 'app-reference-data',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  templateUrl: './reference-data.html'
})
export class ReferenceDataComponent implements OnInit {

  private adminService = inject(AdminService);
  private destroyRef = inject(DestroyRef);
  private transloco = inject(TranslocoService);

  activeTab = signal<ActiveTab>('categories');

  // ── Categories state ────────────────────────────────────────
  categories = signal<Category[]>([]);
  catLoading = signal(false);
  catError = signal<string | null>(null);

  // ── Departments state ───────────────────────────────────────
  departments = signal<Department[]>([]);
  deptLoading = signal(false);
  deptError = signal<string | null>(null);

  // ── Shared modal state ──────────────────────────────────────
  isModalOpen = signal(false);
  modalMode = signal<'create' | 'edit'>('create');

  // ── Category form ───────────────────────────────────────────
  catFormId = '';
  catFormNameEn = '';
  catFormNameAr = '';
  catFormActive = true;

  // ── Department form ─────────────────────────────────────────
  deptFormId = '';
  deptFormNameEn = '';
  deptFormNameAr = '';
  deptFormActive = true;

  // ── Submission state ────────────────────────────────────────
  isSubmitting = signal(false);
  submitError = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadCategories();
    this.loadDepartments();
  }

  // ── Tab switching ───────────────────────────────────────────
  switchTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
  }

  // ── Load categories ─────────────────────────────────────────
  loadCategories(): void {
    this.catLoading.set(true);
    this.catError.set(null);
    this.adminService.getCategories().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data) => {
        this.categories.set(data);
        this.catLoading.set(false);
      },
      error: () => {
        this.catLoading.set(false);
        this.catError.set(this.transloco.translate('admin.referenceData.loadError'));
      }
    });
  }

  // ── Load departments ────────────────────────────────────────
  loadDepartments(): void {
    this.deptLoading.set(true);
    this.deptError.set(null);
    this.adminService.getDepartments().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data) => {
        this.departments.set(data);
        this.deptLoading.set(false);
      },
      error: () => {
        this.deptLoading.set(false);
        this.deptError.set(this.transloco.translate('admin.referenceData.loadError'));
      }
    });
  }

  // ── Open create modal ───────────────────────────────────────
  openCreateModal(): void {
    this.modalMode.set('create');
    this.resetForms();
    this.submitError.set(null);
    this.isModalOpen.set(true);
  }

  // ── Open edit modal ─────────────────────────────────────────
  openEditCategory(cat: Category): void {
    this.modalMode.set('edit');
    this.catFormId = cat.id;
    this.catFormNameEn = cat.nameEn;
    this.catFormNameAr = cat.nameAr;
    this.catFormActive = cat.active;
    this.submitError.set(null);
    this.isModalOpen.set(true);
  }

  openEditDepartment(dept: Department): void {
    this.modalMode.set('edit');
    this.deptFormId = dept.id;
    this.deptFormNameEn = dept.nameEn;
    this.deptFormNameAr = dept.nameAr;
    this.deptFormActive = dept.active;
    this.submitError.set(null);
    this.isModalOpen.set(true);
  }

  // ── Close modal ─────────────────────────────────────────────
  closeModal(): void {
    this.isModalOpen.set(false);
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  // ── Reset forms ─────────────────────────────────────────────
  private resetForms(): void {
    this.catFormId = '';
    this.catFormNameEn = '';
    this.catFormNameAr = '';
    this.catFormActive = true;
    this.deptFormId = '';
    this.deptFormNameEn = '';
    this.deptFormNameAr = '';
    this.deptFormActive = true;
  }

  // ── Submit modal ────────────────────────────────────────────
  submitModal(): void {
    this.submitError.set(null);

    if (this.activeTab() === 'categories') {
      if (this.modalMode() === 'create') {
        this.createCategory();
      } else {
        this.updateCategory();
      }
    } else {
      if (this.modalMode() === 'create') {
        this.createDepartment();
      } else {
        this.updateDepartment();
      }
    }
  }

  // ── Create category ─────────────────────────────────────────
  private createCategory(): void {
    const payload: CreateCategoryPayload = {
      nameEn: this.catFormNameEn.trim(),
      nameAr: this.catFormNameAr.trim(),
      active: this.catFormActive,
    };

    this.isSubmitting.set(true);
    this.adminService.createCategory(payload).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeModal();
        this.loadCategories();
        this.showToast(this.transloco.translate('admin.referenceData.categoryCreated'));
      },
      error: (err) => this.handleSubmitError(err)
    });
  }

  // ── Update category ─────────────────────────────────────────
  private updateCategory(): void {
    const payload: UpdateCategoryPayload = {
      nameEn: this.catFormNameEn.trim(),
      nameAr: this.catFormNameAr.trim(),
      active: this.catFormActive,
    };

    this.isSubmitting.set(true);
    this.adminService.updateCategory(this.catFormId, payload).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (updated) => {
        this.isSubmitting.set(false);
        this.closeModal();
        this.categories.update(list =>
          list.map(c => c.id === updated.id ? updated : c)
        );
        this.showToast(this.transloco.translate('admin.referenceData.categoryUpdated'));
      },
      error: (err) => this.handleSubmitError(err)
    });
  }

  // ── Create department ───────────────────────────────────────
  private createDepartment(): void {
    const payload: CreateDepartmentPayload = {
      nameEn: this.deptFormNameEn.trim(),
      nameAr: this.deptFormNameAr.trim(),
      active: this.deptFormActive,
    };

    this.isSubmitting.set(true);
    this.adminService.createDepartment(payload).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeModal();
        this.loadDepartments();
        this.showToast(this.transloco.translate('admin.referenceData.departmentCreated'));
      },
      error: (err) => this.handleSubmitError(err)
    });
  }

  // ── Update department ───────────────────────────────────────
  private updateDepartment(): void {
    const payload: UpdateDepartmentPayload = {
      nameEn: this.deptFormNameEn.trim(),
      nameAr: this.deptFormNameAr.trim(),
      active: this.deptFormActive,
    };

    this.isSubmitting.set(true);
    this.adminService.updateDepartment(this.deptFormId, payload).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (updated) => {
        this.isSubmitting.set(false);
        this.closeModal();
        this.departments.update(list =>
          list.map(d => d.id === updated.id ? updated : d)
        );
        this.showToast(this.transloco.translate('admin.referenceData.departmentUpdated'));
      },
      error: (err) => this.handleSubmitError(err)
    });
  }

  // ── Error handling ──────────────────────────────────────────
  private handleSubmitError(err: any): void {
    this.isSubmitting.set(false);
    if (err.status === 400) {
      this.submitError.set(err.error?.message || this.transloco.translate('admin.referenceData.validationError'));
    } else if (err.status === 409) {
      this.submitError.set(err.error?.message || this.transloco.translate('admin.referenceData.duplicateError'));
    } else {
      this.submitError.set(err.error?.message || this.transloco.translate('admin.referenceData.saveError'));
    }
  }

  // ── Toast ───────────────────────────────────────────────────
  private showToast(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 4000);
  }

  dismissToast(): void {
    this.successMessage.set(null);
  }
}
