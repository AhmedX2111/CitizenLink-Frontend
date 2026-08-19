import {
  Component, OnInit, signal, inject, DestroyRef, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { UserAdminService } from '../../../core/services/user-admin.service';
import { LoggerService } from '../../../core/services/logger.service';
import { UserResponse, CreateUserRequest, UpdateUserRequest } from '../../../core/models/user.models';
import { PagedResponse } from '../../../core/models/case.models';
import { errorDetails, fieldErrorsFromDetails, logServerError } from '../../../core/utils/server-error';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  templateUrl: './user-list.html',
  styleUrl:    './user-list.css'
})
export class UserListComponent implements OnInit, OnDestroy {

  private userService = inject(UserAdminService);
  private logger      = inject(LoggerService);
  private destroyRef  = inject(DestroyRef);
  private transloco   = inject(TranslocoService);
  private reload$     = new Subject<void>();
  private timers      = new Set<ReturnType<typeof setTimeout>>();

  // ── Filter state ──────────────────────────────────────────────
  filterRole   = '';
  filterActive = '';

  readonly roles   = ['ADMIN', 'SUPERVISOR', 'HANDLER', 'AGENT'];
  readonly statuses = [
    { labelKey: 'admin.users.filter.allStatuses', value: '' },
    { labelKey: 'admin.users.status.active',       value: 'true' },
    { labelKey: 'admin.users.status.inactive',     value: 'false' }
  ];

  // ── List state ────────────────────────────────────────────────
  isLoading     = signal(false);
  loadError     = signal<string | null>(null);
  users         = signal<UserResponse[]>([]);
  totalElements = signal(0);
  totalPages    = signal(0);
  currentPage   = signal(0);
  pageSize      = 20;

  // ── Action dropdown ──────────────────────────────────────────
  actionMenuUserId = signal<string | null>(null);

  // ── Modal state ──────────────────────────────────────────────
  isModalOpen  = signal(false);
  modalMode    = signal<'create' | 'edit'>('create');
  editingUser  = signal<UserResponse | null>(null);
  isSubmitting = signal(false);
  submitError  = signal<string | null>(null);
  fieldErrors  = signal<Record<string, string>>({});

  // ── Form model ───────────────────────────────────────────────
  formUsername     = '';
  formDisplayName  = '';
  formEmail        = '';
  formRole: 'ADMIN' | 'SUPERVISOR' | 'HANDLER' | 'AGENT' = 'AGENT';
  formPassword     = '';
  showPassword     = false;

  // ── Success toast ────────────────────────────────────────────
  successMessage = signal<string | null>(null);

  // ── Action error toast ───────────────────────────────────────
  actionError = signal<string | null>(null);

  get pages(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i);
  }

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
    this.reload$.pipe(
      switchMap(() => {
        this.isLoading.set(true);
        this.loadError.set(null);
        return this.userService.getUsers(
          this.filterRole,
          this.filterActive,
          this.currentPage(),
          this.pageSize
        ).pipe(
          catchError((err) => {
            this.isLoading.set(false);
            this.loadError.set(
              err.status === 403
                ? this.transloco.translate('admin.users.errors.forbidden')
                : this.transloco.translate('admin.users.errors.loadFailed')
            );
            return of(null);
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((res) => {
      if (res) {
        this.users.set(res.content);
        this.totalElements.set(res.totalElements);
        this.totalPages.set(res.totalPages);
        this.isLoading.set(false);
      }
    });

    this.reload$.next();
  }

  applyFilter(): void {
    this.currentPage.set(0);
    this.reload$.next();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.currentPage.set(page);
    this.reload$.next();
  }

  // ── Action dropdown ─────────────────────────────────────────
  closeActionMenu(): void {
    this.actionMenuUserId.set(null);
  }

  toggleActionMenu(userId: string): void {
    this.actionMenuUserId.set(userId === this.actionMenuUserId() ? null : userId);
  }

  // ── Create / Edit modal ─────────────────────────────────────
  openCreateModal(): void {
    this.resetForm();
    this.modalMode.set('create');
    this.editingUser.set(null);
    this.submitError.set(null);
    this.fieldErrors.set({});
    this.isModalOpen.set(true);
    this.closeActionMenu();
  }

  openEditModal(user: UserResponse): void {
    this.resetForm();
    this.modalMode.set('edit');
    this.editingUser.set(user);
    this.formUsername = user.username;
    this.formDisplayName = user.displayName;
    this.formEmail = user.email;
    this.formRole = user.role;
    this.submitError.set(null);
    this.fieldErrors.set({});
    this.isModalOpen.set(true);
    this.closeActionMenu();
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  private resetForm(): void {
    this.formUsername = '';
    this.formDisplayName = '';
    this.formEmail = '';
    this.formRole = 'AGENT';
    this.formPassword = '';
    this.showPassword = false;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  // ── Submit modal ─────────────────────────────────────────────
  submitModal(): void {
    this.submitError.set(null);
    this.fieldErrors.set({});

    if (this.modalMode() === 'create') {
      this.createUser();
    } else {
      this.updateUser();
    }
  }

  private createUser(): void {
    const payload: CreateUserRequest = {
      username: this.formUsername.trim(),
      displayName: this.formDisplayName.trim(),
      email: this.formEmail.trim(),
      role: this.formRole,
      password: this.formPassword,
    };

    this.isSubmitting.set(true);
    this.userService.createUser(payload).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeModal();
        this.reload$.next();
        this.showToast(this.transloco.translate('admin.users.modal.createSuccess'));
      },
      error: (err) => this.handleSubmitError(err)
    });
  }

  private updateUser(): void {
    const user = this.editingUser();
    if (!user) return;

    const payload: UpdateUserRequest = {
      displayName: this.formDisplayName.trim(),
      email: this.formEmail.trim(),
      role: this.formRole,
    };

    this.isSubmitting.set(true);
    this.userService.updateUser(user.id, payload).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (updated) => {
        this.isSubmitting.set(false);
        this.closeModal();
        this.replaceUserInList(updated);
        this.showToast(this.transloco.translate('admin.users.modal.updateSuccess'));
      },
      error: (err) => this.handleSubmitError(err)
    });
  }

  private replaceUserInList(updated: UserResponse): void {
    this.users.update(list =>
      list.map(u => u.id === updated.id ? updated : u)
    );
  }

  private handleSubmitError(err: any): void {
    this.isSubmitting.set(false);
    logServerError(this.logger, 'UserListComponent', err);

    if (err.status === 409) {
      const msg: string = err.error?.message ?? '';
      if (msg.toLowerCase().includes('username')) {
        this.fieldErrors.set({ username: this.transloco.translate('admin.users.modal.duplicateUsername') });
      } else if (msg.toLowerCase().includes('email')) {
        this.fieldErrors.set({ email: this.transloco.translate('admin.users.modal.duplicateEmail') });
      } else {
        this.submitError.set(this.transloco.translate('admin.users.modal.updateFailed'));
      }
    } else if (err.status === 400) {
      const details = errorDetails(err);
      if (details.length > 0) {
        this.fieldErrors.set(
          fieldErrorsFromDetails(details, this.transloco.translate('admin.users.modal.validationFailed'))
        );
      } else {
        this.submitError.set(this.transloco.translate('admin.users.modal.updateFailed'));
      }
    } else if (err.status === 404) {
      this.submitError.set(this.transloco.translate('admin.users.modal.userNotFound'));
    } else {
      this.submitError.set(this.transloco.translate('admin.users.modal.updateFailed'));
    }
  }

  // ── Deactivate / Activate toggle ────────────────────────────
  deactivateUser(user: UserResponse): void {
    this.closeActionMenu();
    const request = user.active
      ? this.userService.deactivateUser(user.id)
      : this.userService.activateUser(user.id);
    request.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (updated) => {
        this.replaceUserInList(updated);
        const key = updated.active ? 'admin.users.modal.activateSuccess' : 'admin.users.modal.deactivateSuccess';
        this.showToast(this.transloco.translate(key));
      },
      error: (err) => {
        if (err.status === 404) {
          this.reload$.next();
        } else {
          this.showActionError(this.transloco.translate('admin.users.modal.deactivateFailed'));
          this.logger.error('UserListComponent', 'Update user status failed:', err.error?.message ?? err);
        }
      }
    });
  }

  // ── Toast ────────────────────────────────────────────────────
  private showToast(msg: string): void {
    this.successMessage.set(msg);
    this.schedule(() => this.successMessage.set(null), 4000);
  }

  dismissToast(): void {
    this.successMessage.set(null);
  }

  private showActionError(msg: string): void {
    this.actionError.set(msg);
    this.schedule(() => this.actionError.set(null), 4000);
  }

  dismissActionError(): void {
    this.actionError.set(null);
  }

  // ── Helpers ──────────────────────────────────────────────────
  initials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  roleBadgeClass(role: string): string {
    const map: Record<string, string> = {
      ADMIN:      'bg-primary text-on-primary',
      SUPERVISOR: 'bg-primary-container text-on-primary-container',
      HANDLER:    'bg-secondary-container text-on-secondary-container',
      AGENT:      'bg-surface-container-high text-on-surface',
    };
    return map[role] ?? 'bg-surface-container text-on-surface';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }
}
